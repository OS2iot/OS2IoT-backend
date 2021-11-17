import {
    Column,
    Entity,
    JoinTable,
    ManyToMany,
    ManyToOne,
    OneToMany,
    Unique,
} from "typeorm";

import { DbBaseEntity } from "@entities/base.entity";
import { DataTarget } from "@entities/data-target.entity";
import { IoTDevice } from "@entities/iot-device.entity";
import { OrganizationApplicationPermission } from "@entities/organization-application-permission.entity";
import { Organization } from "@entities/organization.entity";
import { Multicast } from "./multicast.entity";

@Entity("application")
@Unique(["name"])
export class Application extends DbBaseEntity {
    @Column()
    name: string;

    @Column({ nullable: true })
    description: string;

    @OneToMany(
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        type => IoTDevice,
        iotdevice => iotdevice.application,
        { onDelete: "CASCADE" }
    )
    iotDevices: IoTDevice[];

    @OneToMany(
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        type => DataTarget,
        datatarget => datatarget.application,
        { onDelete: "CASCADE" }
    )
    dataTargets: DataTarget[];

    @OneToMany(
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        type => Multicast,
        multicasts => multicasts.application,
        { onDelete: "CASCADE" }
    )
    multicasts: Multicast[];

    @ManyToOne(
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        type => Organization,
        organization => organization.applications,
        { onDelete: "CASCADE" }
    )
    belongsTo: Organization;

    @ManyToMany(
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        type => OrganizationApplicationPermission,
        permission => permission.applications
    )
    @JoinTable()
    permissions: OrganizationApplicationPermission[];
}
