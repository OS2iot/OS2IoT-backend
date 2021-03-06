import { INestApplication } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { Test, TestingModule } from "@nestjs/testing";
import { NoOpLogger } from "../no-op-logger";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Consumer, KafkaMessage } from "kafkajs";

import configuration from "@config/configuration";
import { RawRequestDto } from "@dto/kafka/raw-request.dto";
import { KafkaTopic } from "@enum/kafka-topic.enum";
import { PayloadDecoderKafkaModule } from "@modules/data-management/payload-decoder-kafka.module";
import { KafkaModule } from "@modules/kafka.module";
import { PayloadDecoderListenerService } from "@services/data-management/payload-decoder-listener.service";

import { setupKafkaListener, sleep, waitForEvents } from "../kafka-test-helpers";
import {
    clearDatabase,
    generateRawRequestLoRaWANKafkaPayload,
    generateSavedApplication,
    generateSavedConnection,
    generateSavedDataTarget,
    generateSavedIoTDevice,
    generateSavedOrganization,
    generateSavedPayloadDecoder,
} from "../test-helpers";

describe(`${PayloadDecoderListenerService.name} (e2e)`, () => {
    let app: INestApplication;
    let service: PayloadDecoderListenerService;
    let consumer: Consumer;

    beforeAll(async () => {
        const moduleFixture: TestingModule = await Test.createTestingModule({
            imports: [
                ConfigModule.forRoot({ load: [configuration] }),
                PayloadDecoderKafkaModule,
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
                KafkaModule,
            ],
        }).compile();
        moduleFixture.useLogger(new NoOpLogger());

        app = moduleFixture.createNestApplication();
        await app.init();
        service = moduleFixture.get(PayloadDecoderListenerService.name);

        // Get a reference to the repository such that we can CRUD on it.
        consumer = await setupKafkaListener(consumer, [], KafkaTopic.RAW_REQUEST);
        await sleep(100);
        await consumer.disconnect();
    }, 30000);

    afterAll(async () => {
        // Ensure clean shutdown
        await app.close();
    }, 30000);

    beforeEach(async () => {
        // Clear data before each test
        await clearDatabase();
    });

    afterEach(async () => {
        // Clear data after each test
        await clearDatabase();
        if (consumer) {
            await consumer.disconnect();
        }
    }, 30000 /* Increate timeout to 30 secs, since the disconnect can be slow */);

    it("Test rawRequestListener - All OK", async () => {
        // Arrange
        const org = await generateSavedOrganization();
        const application = await generateSavedApplication(org);
        const iotDevice = await generateSavedIoTDevice(application);
        const kafkaPayload = generateRawRequestLoRaWANKafkaPayload(iotDevice.id);
        kafkaPayload.body.unixTimestamp = null;
        const rawPayload = (kafkaPayload.body as RawRequestDto).rawPayload;
        const payloadDecoder = await generateSavedPayloadDecoder(org);
        const dataTarget = await generateSavedDataTarget(application);
        await generateSavedConnection(iotDevice, dataTarget, payloadDecoder);
        await generateSavedConnection(iotDevice, dataTarget);

        // Store all the messages sent to kafka
        const kafkaMessages: [string, KafkaMessage][] = [];

        // Setup kafkaListener to see if it is sent correctly.
        consumer = await setupKafkaListener(
            consumer,
            kafkaMessages,
            KafkaTopic.TRANSFORMED_REQUEST
        );

        // Act
        await service.rawRequestListener(kafkaPayload);

        // Sleep a bit until the message is processed (to avoid race-condition)
        await waitForEvents(kafkaMessages, 2);

        // Assert
        expect(kafkaMessages.length).toBeGreaterThanOrEqual(2);

        // Pull out the payloads passed along after transforming
        const payloads = kafkaMessages.map(x => {
            return JSON.parse(x[1].value.toString("utf8")).body.payload;
        });

        // Expect the decoded payload
        expect(payloads).toContainEqual({
            decoded: {
                humidity: 49,
                light: 139,
                motion: 8,
                temperature: 27.9,
                vdd: 3645,
            },
        });
        // Expect the non-decoded payload
        expect(payloads).toContainEqual(rawPayload);
    }, 60000);
});

// TODO: rainy day test-case (dårlig JS)
