﻿import { BeforeInsert, ChildEntity, Column } from "typeorm";
import { IoTDeviceType } from "@enum/device-type.enum";
import { IoTDevice } from "@entities/iot-device.entity";
import { AuthenticationType } from "@enum/authentication-type.enum";
import { MQTTPermissionLevel } from "@enum/mqtt-permission-level.enum";

@ChildEntity(IoTDeviceType.MQTTBroker)
export class MQTTBrokerDevice extends IoTDevice {
    @Column("enum", {
        enum: AuthenticationType,
    })
    authenticationType: AuthenticationType;

    @Column({ nullable: true })
    caCertificate: string;

    @Column({ nullable: true })
    deviceCertificate: string;

    @Column({ nullable: true })
    deviceCertificateKey: string; // Should be encrypted at a minimum

    @Column({ nullable: true })
    mqttusername: string;

    @Column({ nullable: true })
    mqttpassword: string;

    @Column({ nullable: true })
    mqttURL: string;

    @Column({ nullable: true })
    mqttPort: number;

    @Column({ nullable: true })
    mqtttopicname: string;

    @Column("enum", {
        nullable: true,
        enum: MQTTPermissionLevel,
    })
    permissions: MQTTPermissionLevel;

    @BeforeInsert()
    private beforeInsert() {
        this.type = IoTDeviceType.MQTTBroker;
    }
}