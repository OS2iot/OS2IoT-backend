import { AuthenticatedUser } from "@dto/internal/authenticated-user";
import { PermissionType } from "@enum/permission-type.enum";
import { CanActivate, ExecutionContext, Injectable, Logger } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { RolesMetaData } from "./constants";

@Injectable()
export class RolesGuard implements CanActivate {
    constructor(private reflector: Reflector) {}

    private readonly logger = new Logger(RolesGuard.name);

    canActivate(context: ExecutionContext): boolean {
        const roleRequiredMethod = this.reflector.get<string>(
            RolesMetaData,
            context.getHandler()
        );
        const roleRequiredClass = this.reflector.get<string>(
            RolesMetaData,
            context.getClass()
        );
        const roleRequired = roleRequiredMethod ?? roleRequiredClass;

        if (!roleRequired) {
            return true;
        }

        const request = context.switchToHttp().getRequest();
        // TODO: This should either be JWT or Api key request.
        const user: AuthenticatedUser = request.user;
        this.logger.verbose(
            JSON.stringify({
                msg: "Authorized user using JWT",
                userId: user.userId,
                userName: user.username,
            })
        );
        return this.hasAccess(user, roleRequired);
    }

    hasAccess(user: AuthenticatedUser, roleRequired: string): boolean {
        if (user.permissions.isGlobalAdmin) {
            return true;
        } else if (roleRequired == PermissionType.OrganizationAdmin) {
            return this.hasOrganizationAdminAccess(user);
        } else if (roleRequired == PermissionType.Write) {
            return this.hasOrganizationAdminAccess(user) || this.hasWriteAccess(user);
        } else if (roleRequired == PermissionType.Read) {
            return (
                this.hasOrganizationAdminAccess(user) ||
                this.hasWriteAccess(user) ||
                this.hasReadAccess(user)
            );
        }

        return false;
    }

    hasOrganizationAdminAccess(user: AuthenticatedUser): boolean {
        return user.permissions.organizationAdminPermissions.size > 0;
    }

    hasWriteAccess(user: AuthenticatedUser): boolean {
        return this.hasSomeAccess(user.permissions.writePermissions);
    }

    hasReadAccess(user: AuthenticatedUser): boolean {
        return this.hasSomeAccess(user.permissions.readPermissions);
    }

    hasSomeAccess(userPermission: Map<number, number[]>): boolean {
        return userPermission.size > 0;
    }
}
