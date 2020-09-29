import { HttpModule, Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { TypeOrmModule } from "@nestjs/typeorm";

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
import { SigFoxAdministrationModule } from "./device-integrations/sigfox-administration.module";

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
                maxQueryExecutionTime: 200, // Log queries slower than 200 ms
            }),
        }),
        KafkaModule.register({
            clientId: process.env.KAFKA_CLIENTID || "os2iot-client",
            brokers: [
                `${process.env.KAFKA_HOSTNAME || "host.docker.internal"}:${
                    process.env.KAFKA_PORT || "9093"
                }`,
            ],
            groupId: process.env.KAFKA_GROUPID || "os2iot-backend",
        }),
        HttpModule,
        ApplicationModule,
        IoTDeviceModule,
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
    ],
    controllers: [],
    providers: [],
})
export class AppModule {}
