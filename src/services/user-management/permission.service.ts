import { BadRequestException, Inject, Injectable, forwardRef } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import * as _ from "lodash";
import {
    In,
    Repository,
    getManager,
    createQueryBuilder,
    SelectQueryBuilder,
} from "typeorm";

import { DeleteResponseDto } from "@dto/delete-application-response.dto";
import { ListAllPermissionsResponseDto } from "@dto/list-all-permissions-response.dto";
import { PermissionMinimalDto } from "@dto/permission-minimal.dto";
import { UserPermissions } from "@dto/permission-organization-application.dto";
import { CreatePermissionDto } from "@dto/user-management/create-permission.dto";
import { UpdatePermissionDto } from "@dto/user-management/update-permission.dto";
import { Organization } from "@entities/organization.entity";
import { Permission } from "@entities/permissions/permission.entity";
import { User } from "@entities/user.entity";
import { PermissionType } from "@enum/permission-type.enum";
import { ApplicationService } from "@services/device-management/application.service";
import { OrganizationService } from "@services/user-management/organization.service";

import { UserService } from "./user.service";
import { Application } from "@entities/application.entity";
import { AuditLog } from "@services/audit-log.service";
import { ActionType } from "@entities/audit-log-entry";
import { ListAllEntitiesDto } from "@dto/list-all-entities.dto";
import { ListAllPermissionsDto } from "@dto/list-all-permissions.dto";
import { isOrganizationApplicationPermission } from "@helpers/security-helper";
import { PermissionTypeEntity } from "@entities/permissions/permission-type.entity";
import { PermissionCreator } from "@helpers/permission.helper";

@Injectable()
export class PermissionService {
    constructor(
        @InjectRepository(Permission)
        private permissionRepository: Repository<Permission>,
        @Inject(forwardRef(() => OrganizationService))
        private organizationService: OrganizationService,
        @Inject(forwardRef(() => UserService))
        private userService: UserService,
        @Inject(forwardRef(() => ApplicationService))
        private applicationService: ApplicationService
    ) {}

    async createDefaultPermissions(
        org: Organization,
        userId: number
    ): Promise<Permission[]> {
        const { readPermission, orgApplicationAdminPermission, orgAdminPermission, orgGatewayAadminPermission } = this.instantiateDefaultPermissions(org, userId);

        // Use the manager since otherwise, we'd need a repository for each of them
        const entityManager = getManager();
        const r = await entityManager.save<Permission>([
            readPermission,
            orgApplicationAdminPermission,
            orgAdminPermission,
            orgGatewayAadminPermission,
        ]);
        r.forEach(val =>
            AuditLog.success(ActionType.CREATE, Permission.name, userId, val.id, val.name)
        );
        return r;
    }

    private instantiateDefaultPermissions(org: Organization, userId: number) {
        const nameSuffixSeparator = " - ";
        const readSuffix = `${nameSuffixSeparator}${PermissionType.Read}`;
        const organizationUserAdminSuffix = `${nameSuffixSeparator}${PermissionType.OrganizationUserAdmin}`;
        const organizationGatewayAdminSuffix = `${nameSuffixSeparator}${PermissionType.OrganizationGatewayAdmin}`;
        const organizationApplicationAdminSuffix = `${nameSuffixSeparator}${PermissionType.OrganizationApplicationAdmin}`;

        const readPermission = PermissionCreator.createRead(org.name + readSuffix, org, true);
        const orgApplicationAdminPermission = PermissionCreator.createApplicationAdmin(
            org.name + organizationApplicationAdminSuffix,
            org,
            true
        );
        const orgAdminPermission = PermissionCreator.createUserAdmin(
            org.name + organizationUserAdminSuffix,
            org
        );
        const orgGatewayAadminPermission = PermissionCreator.createGatewayAdmin(
            org.name + organizationGatewayAdminSuffix,
            org
        );
        readPermission.createdBy = userId;
        readPermission.updatedBy = userId;
        orgApplicationAdminPermission.createdBy = userId;
        orgApplicationAdminPermission.updatedBy = userId;
        orgAdminPermission.createdBy = userId;
        orgAdminPermission.updatedBy = userId;
        orgGatewayAadminPermission.createdBy = userId;
        orgGatewayAadminPermission.updatedBy = userId;
        return { readPermission, orgApplicationAdminPermission, orgAdminPermission, orgGatewayAadminPermission };
    }

    async findOrCreateGlobalAdminPermission(): Promise<Permission> {
        const globalAdmin = await this.permissionRepository.findOne({
            where: {
                // TODO: PERMISSION REIVSED. Will this work?
                type: {
                    type: PermissionType.GlobalAdmin
                }
            }
        });
        if (globalAdmin) {
            return globalAdmin;
        }

        return await getManager().save(PermissionCreator.createGlobalAdmin());
    }

    async createNewPermission(
        dto: CreatePermissionDto,
        userId: number
    ): Promise<Permission> {
        const org: Organization = await this.organizationService.findById(
            dto.organizationId
        );

        const permission = PermissionCreator.createByTypes(
            dto.name,
            dto.levels.map(level => level.type),
            org,
            dto.automaticallyAddNewApplications
        );
        permission.type.forEach(type => {
            type.createdBy = userId;
            type.updatedBy = userId;
        });

        await this.mapToPermission(permission, dto);
        permission.createdBy = userId;
        permission.updatedBy = userId;

        return await getManager().save(permission);
    }

    async autoAddPermissionsToApplication(app: Application): Promise<void> {
        const permissionsInOrganisation = await this.permissionRepository.find(
            {
                where: {
                    // TODO: PERMISSION REIVSED. Will this work?
                    type: {
                        type: PermissionType.OrganizationApplicationAdmin
                    },
                    organization: {
                        id: app.belongsTo.id,
                    },
                    automaticallyAddNewApplications: true,
                },
                relations: ["applications"],
            }
        );

        await Promise.all(
            permissionsInOrganisation.map(async p => {
                p.applications.push(app);
                await getManager().save(p);
            })
        );
    }

    async addUsersToPermission(permission: Permission, users: User[]): Promise<void> {
        users.forEach(x => {
            x.permissions = _.union(x.permissions, [permission]);
        });
    }

    async removeUserFromPermission(permission: Permission, user: User): Promise<void> {
        user.permissions = user.permissions.filter(x => x.id != permission.id);
    }

    async updatePermission(
        id: number,
        dto: UpdatePermissionDto,
        userId: number
    ): Promise<Permission> {
        const permission = await getManager().findOne(Permission, {
            where: { id: id },
            relations: ["organization", "users", "applications", "type"],
        });

        permission.name = dto.name;

        await this.mapToPermission(permission, dto);
        permission.updatedBy = userId;

        const savedPermission = await getManager().save(permission);

        return savedPermission;
    }

    private async mapToPermission(
        permission: Permission,
        dto: UpdatePermissionDto
    ): Promise<void> {
        // TODO: Is it just as easy to make the frontend do it? What happens if this issue goes through?
        // Sanitize types
        permission.type = _.uniqBy(permission.type, type => type.type)

        if (isOrganizationApplicationPermission(permission)) {
            permission.applications = await this.applicationService.findManyByIds(
                dto.applicationIds
            );

            permission.automaticallyAddNewApplications =
                dto.automaticallyAddNewApplications;
        }
        if (dto?.userIds?.length >= 0) {
            permission.users = await this.userService.findManyUsersByIds(dto.userIds);
        }
    }

    async deletePermission(id: number): Promise<DeleteResponseDto> {
        const res = await getManager().delete(Permission, id);
        return new DeleteResponseDto(res.affected);
    }

    async getAllPermissions(
        query?: ListAllPermissionsDto,
        orgs?: number[]
    ): Promise<ListAllPermissionsResponseDto> {
        const orderBy = this.getSorting(query);
        const order: "DESC" | "ASC" =
            query?.sort?.toLocaleUpperCase() == "DESC" ? "DESC" : "ASC";
        let qb: SelectQueryBuilder<Permission> = createQueryBuilder(
            Permission,
            "permission"
        )
            .leftJoinAndSelect("permission.organization", "org")
            .leftJoinAndSelect("permission.users", "user")
            .leftJoinAndSelect("permission.type", "permission_type")
            .take(query?.limit ? +query.limit : 100)
            .skip(query?.offset ? +query.offset : 0)
            .orderBy(orderBy, order);

        if (query?.userId) {
            qb = qb.where("user.id = :userId", { userId: +query.userId });
        } else if (orgs) {
            qb.where({ organization: In(orgs) });
        } else if (query?.organisationId) {
            qb = qb.where("org.id = :orgId", { orgId: +query.organisationId });
        }

        const [data, count] = await qb.getManyAndCount();

        return {
            data: data,
            count: count,
        };
    }

    private getSorting(query: ListAllPermissionsDto | undefined) {
        let orderBy = `permission.id`;
        if (
            query?.orderOn != null &&
            (query.orderOn == "id" ||
                query.orderOn == "name" ||
                query.orderOn == "type" ||
                query.orderOn == "organisations")
        ) {
            if (query.orderOn == "organisations") {
                orderBy = "org.name";
            } else {
                orderBy = `permission.${query.orderOn}`;
            }
        }
        return orderBy;
    }

    async getAllPermissionsInOrganizations(
        orgs: number[],
        query?: ListAllEntitiesDto
    ): Promise<ListAllPermissionsResponseDto> {
        return this.getAllPermissions(query, orgs);
    }

    async getPermission(id: number): Promise<Permission> {
        return await getManager().findOneOrFail(Permission, {
            where: { id: id },
            relations: ["organization", "users", "applications", "type"],
            loadRelationIds: {
                relations: ["createdBy", "updatedBy"],
            },
        });
    }

    buildPermissionsQuery(): SelectQueryBuilder<Permission> {
        return this.permissionRepository
            .createQueryBuilder("permission")
            .leftJoinAndSelect(
                "application_permissions_permission",
                "application_permission",
                '"permission"."id" = "application_permission"."permissionId"'
            )
            .leftJoinAndSelect(
                "application",
                "application",
                '"application"."id"="application_permission"."applicationId" '
            )
            .leftJoinAndSelect(
                "permission_type",
                "permission_type",
                '"permission_type"."permissionId"="permission"."id"'
            )
            .select([
                "permission_type.type as permission_type_type",
                "permission.organization as organization_id",
                "application.id as application_id",
            ]);
    }

    async findPermissionsForUser(userId: number): Promise<PermissionMinimalDto[]> {
        return await this.buildPermissionsQuery()
            .leftJoin("permission.users", "user")
            .where("user.id = :id", { id: userId })
            .getRawMany();
    }

    async findPermissionsForApiKey(apiKeyId: number): Promise<PermissionMinimalDto[]> {
        return await this.buildPermissionsQuery()
            .leftJoin("permission.apiKeys", "apiKey")
            .where("apiKey.id = :id", { id: apiKeyId })
            .getRawMany();
    }

    async findPermissionsForOrgAdminWithApplications(
        userId: number
    ): Promise<PermissionMinimalDto[]> {
        return await this.buildPermissionsWithApplicationsQuery()
            .leftJoin("permission.users", "user")
            .where("permission_type.type = :permType AND user.id = :id", {
                permType: PermissionType.OrganizationApplicationAdmin,
                id: userId,
            })
            .getRawMany();
    }

    buildPermissionsWithApplicationsQuery(): SelectQueryBuilder<Permission> {
        return this.permissionRepository
            .createQueryBuilder("permission")
            .leftJoinAndSelect("permission.organization", "organization")
            .leftJoinAndSelect("organization.applications", "application")
            .leftJoinAndSelect("permission.type", "permission_type")
            .select([
                "permission_type.type as permission_type_type",
                "permission.organization as organization_id",
                "application.id as application_id",
            ]);
    }

    async findPermissionsForApiKeyOrgAdminWithApplications(
        apiKeyId: number
    ): Promise<PermissionMinimalDto[]> {
        return await this.buildPermissionsWithApplicationsQuery()
            .leftJoin("permission.apiKeys", "apiKey")
            .where("permission.type = :permType AND apiKey.id = :id", {
                permType: PermissionType.OrganizationUserAdmin,
                id: apiKeyId,
            })
            .getRawMany();
    }

    async findPermissionGroupedByLevelForUser(userId: number): Promise<UserPermissions> {
        let permissions = await this.findPermissionsForUser(userId);
        if (this.isOrganizationApplicationAdmin(permissions)) {
            // For organization admins, we need to fetch all applications they have permissions to
            const permissionsForOrgAdmin = await this.findPermissionsForOrgAdminWithApplications(
                userId
            );
            permissions = _.union(permissions, permissionsForOrgAdmin);
        }

        return this.createUserPermissionsFromPermissions(permissions);
    }

    async findPermissionGroupedByLevelForApiKey(
        apiKeyId: number
    ): Promise<UserPermissions> {
        let permissions = await this.findPermissionsForApiKey(apiKeyId);
        if (this.isOrganizationUserAdmin(permissions)) {
            // For organization admins, we need to fetch all applications they have permissions to
            const permissionsForOrgAdmin = await this.findPermissionsForApiKeyOrgAdminWithApplications(
                apiKeyId
            );
            permissions = _.union(permissions, permissionsForOrgAdmin);
        }
        return this.createUserPermissionsFromPermissions(permissions);
    }

    private createUserPermissionsFromPermissions(
        permissions: PermissionMinimalDto[]
    ): UserPermissions {
        const res = new UserPermissions();

        permissions.forEach(p => {
            if (p.permission_type_type == PermissionType.GlobalAdmin) {
                res.isGlobalAdmin = true;
            } else if (p.permission_type_type == PermissionType.OrganizationApplicationAdmin) {
                 this.addOrUpdateApplicationIds(res.orgToApplicationAdminPermissions, p);
            } else if (p.permission_type_type == PermissionType.OrganizationGatewayAdmin) {
                res.orgToGatewayAdminPermissions.add(p.organization_id);
            } else if (p.permission_type_type == PermissionType.OrganizationUserAdmin) {
                res.orgToUserAdminPermissions.add(p.organization_id);
            } else if (p.permission_type_type == PermissionType.Read) {
                this.addOrUpdateApplicationIds(res.orgToReadPermissions, p);
            }
        });

        return res;
    }

    async findManyByIds(ids: number[]): Promise<Permission[]> {
        return await this.permissionRepository.findByIds(ids);
    }

    private isOrganizationApplicationAdmin(permissions: PermissionMinimalDto[]) {
        return permissions.some(
            x => x.permission_type_type == PermissionType.OrganizationApplicationAdmin
        );
    }

    private isOrganizationUserAdmin(permissions: PermissionMinimalDto[]) {
        return permissions.some(
            x => x.permission_type_type == PermissionType.OrganizationUserAdmin
        );
    }

    private addOrUpdateApplicationIds(permissions: Map<number, number[]>, p: PermissionMinimalDto) {
        if (!permissions.has(p.organization_id)) {
            permissions.set(p.organization_id, []);
        }
        const applications = permissions.get(p.organization_id);
        if (p.application_id != null) {
            applications.push(p.application_id);
        }
        permissions.set(p.organization_id, applications);
    }
}
