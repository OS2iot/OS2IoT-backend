import { INestApplication } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { Test, TestingModule } from "@nestjs/testing";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Consumer, KafkaMessage } from "kafkajs";
import * as request from "supertest";

import configuration from "@config/configuration";
import { KafkaTopic } from "@enum/kafka-topic.enum";
import { SigFoxListenerModule } from "@modules/device-integrations/sigfox-listener.module";
import { KafkaModule } from "@modules/kafka.module";

import { setupKafkaListener, waitForEvents } from "../kafka-test-helpers";
import {
    SIGFOX_PAYLOAD_2,
    clearDatabase,
    generateSavedApplication,
    generateSavedOrganization,
    generateSavedSigfoxDevice,
    SIGFOX_PAYLOAD,
} from "../test-helpers";

describe("SigFoxListenerController (e2e)", () => {
    let app: INestApplication;
    let consumer: Consumer;

    beforeAll(async () => {
        const moduleFixture: TestingModule = await Test.createTestingModule({
            imports: [
                ConfigModule.forRoot({ load: [configuration] }),
                TypeOrmModule.forRoot({
                    type: "postgres",
                    host: "host.docker.internal",
                    port: 5433,
                    username: "os2iot",
                    password: "toi2so",
                    database: "os2iot-e2e",
                    synchronize: true,
                    logging: false,
                    autoLoadEntities: true,
                }),
                KafkaModule.register({
                    clientId: "os2iot-client-e2e",
                    brokers: ["host.docker.internal:9093"],
                    groupId: "os2iot-backend-e2e",
                }),
                SigFoxListenerModule,
            ],
        }).compile();

        app = moduleFixture.createNestApplication();
        await app.init();
    });

    afterAll(async () => {
        // Ensure clean shutdown
        await app.close();
    });

    beforeEach(async () => {
        await clearDatabase();
    });

    afterEach(async () => {
        await clearDatabase();
        if (consumer) {
            await consumer.disconnect();
        }
    }, 30000);

    it("(POST) /sigfox-callback/data/uplink - Receive data from Sigfox backend", async () => {
        const org = await generateSavedOrganization();
        const application = await generateSavedApplication(org);
        const sigfoxDevice = await generateSavedSigfoxDevice(application);
        const payload = JSON.parse(SIGFOX_PAYLOAD);

        // Store all the messages sent to kafka
        const kafkaMessages: [string, KafkaMessage][] = [];

        // Setup kafkaListener to see if it is sent correctly.
        consumer = await setupKafkaListener(
            consumer,
            kafkaMessages,
            KafkaTopic.RAW_REQUEST
        );

        // Act
        await request(app.getHttpServer())
            .post("/sigfox-callback/data/uplink?apiKey=" + sigfoxDevice.deviceTypeId)
            .send(payload)
            .expect(204);

        // Sleep a bit until the message is processed (to avoid race-condition)
        await waitForEvents(kafkaMessages, 1);

        // Assert

        // Pull out the payloads passed along after transforming
        const payloads = kafkaMessages.map(x => {
            return JSON.parse(x[1].value.toString("utf8")).body;
        });
        expect(payloads).toHaveLength(1);
    }, 10000);

    it("(POST) /receive-data/  receive data from unregistered edge device (Test invalid API key)- expected 403- fobbidden", async () => {
        return await request(app.getHttpServer())
            .post("/sigfox-callback/data/uplink?apiKey=" + "invalidKey")
            .send(SIGFOX_PAYLOAD_2)
            .expect(400);
    });
});
