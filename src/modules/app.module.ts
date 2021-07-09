import { HttpModule, Module, RequestMethod } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { TypeOrmModule } from "@nestjs/typeorm";
import { LoggerModule } from "nestjs-pino";

import configuration from "@config/configuration";
import { PayloadDecoderKafkaModule } from "@modules/data-management/payload-decoder-kafka.module";
import { DataTargetKafkaModule } from "@modules/data-target/data-target-kafka.module";
import { DataTargetSenderModule } from "@modules/data-target/data-target-sender.module";
import { DefaultModule } from "@modules/default.module";
import { ChirpstackAdministrationModule } from "@modules/device-integrations/chirpstack-administration.module";
import { ChirpstackMqttListenerModule } from "@modules/device-integrations/chirpstack-mqtt-listener.module";
import { ReceiveDataModule } from "@modules/device-integrations/receive-data.module";
import { SigFoxListenerModule } from "@modules/device-integrations/sigfox-listener.module";
import { ApplicationModule } from "@modules/device-management/application.module";
import { DataTargetModule } from "@modules/device-management/data-target.module";
import { IoTDevicePayloadDecoderDataTargetConnectionModule } from "@modules/device-management/iot-device-payload-decoder-data-target-connection.module";
import { IoTDeviceModule } from "@modules/device-management/iot-device.module";
import { PayloadDecoderModule } from "@modules/device-management/payload-decoder.module";
import { KafkaModule } from "@modules/kafka.module";
import { AuthModule } from "@modules/user-management/auth.module";
import { OrganizationModule } from "@modules/user-management/organization.module";
import { PermissionModule } from "@modules/user-management/permission.module";
import { SigFoxAdministrationModule } from "@modules/device-integrations/sigfox-administration.module";
import { SigfoxDeviceTypeModule } from "@modules/device-integrations/sigfox-device-type.module";
import { SigFoxGroupModule } from "@modules/device-integrations/sigfox-group.module";
import { SigfoxContractModule } from "@modules/device-integrations/sigfox-contract.module";
import { SigfoxDeviceModule } from "@modules/device-integrations/sigfox-device.module";
import { ScheduleModule } from "@nestjs/schedule";
import { SearchModule } from "./search.module";
import { DeviceModelModule } from "./device-management/device-model.module";
import { TestPayloadDecoderModule } from "./test-payload-decoder.module";
import { OpenDataDkSharingModule } from "./open-data-dk-sharing.module";

@Module({
    imports: [
        ConfigModule.forRoot({
            load: [configuration],
        }),
        TypeOrmModule.forRootAsync({
            imports: [ConfigModule],
            inject: [ConfigService],
            useFactory: async (configService: ConfigService) => ({
                type: "postgres" as const,
                host: configService.get<string>("database.host"),
                port: configService.get<number>("database.port"),
                username: configService.get<string>("database.username"),
                password: configService.get<string>("database.password"),
                database: "os2iot",
                synchronize: true,
                logging: false,
                autoLoadEntities: true,
                retryAttempts: 0,
                maxQueryExecutionTime: 1000, // Log queries slower than 1000 ms
                ssl: configService.get<boolean>("database.ssl")
            }),
        }),
        // LoggerModule.forRoot({
        //     pinoHttp: { useLevel: "debug", autoLogging: false },
        //     exclude: [{ method: RequestMethod.GET, path: "" }],
        // }),
        KafkaModule,
        ScheduleModule.forRoot(),
        HttpModule,
        ApplicationModule,
        IoTDeviceModule,
        DeviceModelModule,
        DataTargetModule,
        DataTargetKafkaModule,
        DataTargetSenderModule,
        ReceiveDataModule,
        ChirpstackAdministrationModule,
        PayloadDecoderModule,
        IoTDevicePayloadDecoderDataTargetConnectionModule,
        ChirpstackMqttListenerModule,
        PayloadDecoderKafkaModule,
        DefaultModule,
        AuthModule,
        OrganizationModule,
        PermissionModule,
        SigFoxListenerModule,
        SigFoxAdministrationModule,
        SigFoxGroupModule,
        SigfoxDeviceTypeModule,
        SigfoxContractModule,
        SigfoxDeviceModule,
        SearchModule,
        TestPayloadDecoderModule,
        OpenDataDkSharingModule,
    ],
    controllers: [],
    providers: [],
})
export class AppModule {}
