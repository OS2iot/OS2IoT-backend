import { Entity, Column, OneToMany } from "typeorm";
import { DbBaseEntity } from "./base.entity";
import { IoTDevice } from "./iotdevice.entity";

@Entity("application")
export class Application extends DbBaseEntity {
    @Column()
    name: string;

    @Column()
    description: string;

    @OneToMany(
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        type => IoTDevice,
        iotdevice => iotdevice.application
    )
    iotDevices: IoTDevice[];

    toString(): string {
        return `Application: id: ${this.id} - name: ${this.name}`;
    }
}
