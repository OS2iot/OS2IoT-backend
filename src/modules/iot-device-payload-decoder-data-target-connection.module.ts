import { Module, forwardRef, HttpModule } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { IoTDevicePayloadDecoderDataTargetConnection } from "@entities/iot-device-payload-decoder-data-target-connection.entity";
import { IoTDevicePayloadDecoderDataTargetConnectionService } from "@services/iot-device-payload-decoder-data-target-connection.service";
import { IoTDevicePayloadDecoderDataTargetConnectionController } from "@admin-controller/iot-device-payload-decoder-data-target-connection.controller";
import { PayloadDecoder } from "@entities/payload-decoder.entity";
import { Application } from "@entities/application.entity";
import { IoTDevice } from "@entities/iot-device.entity";
import { GenericHTTPDevice } from "@entities/generic-http-device.entity";
import { DataTarget } from "@entities/data-target.entity";
import { HttpPushDataTarget } from "@entities/http-push-data-target.entity";
import { ReceivedMessage } from "@entities/received-message";
import { ReceivedMessageMetadata } from "@entities/received-message-metadata";
import { IoTDeviceModule } from "./iot-device.module";
import { DataTargetModule } from "./data-target.module";
import { PayloadDecoderModule } from "./payload-decoder.module";
import { IoTDeviceService } from "@services/iot-device.service";
import { DataTargetService } from "../services/data-target.service";
import { PayloadDecoderService } from "../services/payload-decoder.service";
import { ApplicationService } from "../services/application.service";
import { ChirpstackAdministrationModule } from "./device-integrations/chirpstack-administration.module";
import { ChirpstackDeviceService } from "@services/chirpstack/chirpstack-device.service";
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

@Module({
    imports: [
        TypeOrmModule.forFeature([
            IoTDevicePayloadDecoderDataTargetConnection,
            PayloadDecoder,
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
        IoTDeviceModule,
        DataTargetModule,
        forwardRef(() => PayloadDecoderModule),
        ChirpstackAdministrationModule,
        HttpModule,
        ApplicationModule,
    ],
    providers: [IoTDevicePayloadDecoderDataTargetConnectionService],
    exports: [IoTDevicePayloadDecoderDataTargetConnectionService],
    controllers: [IoTDevicePayloadDecoderDataTargetConnectionController],
})
export class IoTDevicePayloadDecoderDataTargetConnectionModule {}
