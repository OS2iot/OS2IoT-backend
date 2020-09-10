import { Module, HttpModule } from "@nestjs/common";
import { DataTargetKafkaListenerService } from "@services/data-targets/data-target-kafka-listener.service";
import { KafkaModule } from "@modules/kafka.module";
import { Application } from "@entities/application.entity";
import { IoTDevice } from "@entities/iot-device.entity";
import { GenericHTTPDevice } from "@entities/generic-http-device.entity";
import { TypeOrmModule } from "@nestjs/typeorm";
import { DataTarget } from "@entities/data-target.entity";
import { HttpPushDataTarget } from "@entities/http-push-data-target.entity";
import { DataTargetSenderModule } from "@modules/data-target-sender.module";
import { IoTDeviceModule } from "./iot-device.module";
import { ReceivedMessage } from "@entities/received-message";
import { ReceivedMessageMetadata } from "@entities/received-message-metadata";
import { DeviceIntegrationPersistenceModule } from "@modules/data-management/device-integration-persistence.module";
import { ChirpstackAdministrationModule } from "@modules/device-integrations/chirpstack-administration.module";
import { IoTDevicePayloadDecoderDataTargetConnectionModule } from "@modules/iot-device-payload-decoder-data-target-connection.module";
import { Organization } from "@entities/organization.entity";
import { User } from "@entities/user.entity";
import { Permission } from "@entities/permission.entity";
import { GlobalAdminPermission } from "@entities/global-admin-permission.entity";
import { OrganizationPermission } from "@entities/organizion-permission.entity";
import { OrganizationAdminPermission } from "@entities/organization-admin-permission.entity";
import { OrganizationApplicationPermission } from "@entities/organization-application-permission.entity";
import { ReadPermission } from "@entities/read-permission.entity";
import { WritePermission } from "@entities/write-permission.entity";
import { ApplicationModule } from "./application.module";
import { DataTargetModule } from "./data-target.module";

@Module({
    imports: [
        TypeOrmModule.forFeature([
            Application,
            IoTDevice,
            GenericHTTPDevice,
            DataTarget,
            HttpPushDataTarget,
            ReceivedMessage,
            ReceivedMessageMetadata,
            Organization,
            User,
            Permission,
            GlobalAdminPermission,
            OrganizationPermission,
            OrganizationAdminPermission,
            OrganizationApplicationPermission,
            ReadPermission,
            WritePermission,
        ]),
        HttpModule,
        KafkaModule,
        DataTargetSenderModule,
        DeviceIntegrationPersistenceModule,
        IoTDeviceModule,
        ChirpstackAdministrationModule,
        IoTDevicePayloadDecoderDataTargetConnectionModule,
        ApplicationModule,
        DataTargetModule,
    ],
    providers: [DataTargetKafkaListenerService],
})
export class DataTargetKafkaModule {}
