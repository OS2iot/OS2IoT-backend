import { JwtService } from "@nestjs/jwt";
import { getManager } from "typeorm";
import * as request from "supertest";

import { JwtPayloadDto } from "@dto/internal/jwt-payload.dto";
import { RawRequestDto } from "@dto/kafka/raw-request.dto";
import { Application } from "@entities/application.entity";
import { DataTarget } from "@entities/data-target.entity";
import { GenericHTTPDevice } from "@entities/generic-http-device.entity";
import { GlobalAdminPermission } from "@entities/permissions/global-admin-permission.entity";
import { HttpPushDataTarget } from "@entities/http-push-data-target.entity";
import { IoTDevicePayloadDecoderDataTargetConnection } from "@entities/iot-device-payload-decoder-data-target-connection.entity";
import { IoTDevice } from "@entities/iot-device.entity";
import { LoRaWANDevice } from "@entities/lorawan-device.entity";
import { Organization } from "@entities/organization.entity";
import { PayloadDecoder } from "@entities/payload-decoder.entity";
import { Permission } from "@entities/permissions/permission.entity";
import { ReadPermission } from "@entities/permissions/read-permission.entity";
import { SigFoxDevice } from "@entities/sigfox-device.entity";
import { User } from "@entities/user.entity";
import { KafkaTopic } from "@enum/kafka-topic.enum";
import { PermissionType } from "@enum/permission-type.enum";
import { ChirpstackSetupNetworkServerService } from "@services/chirpstack/network-server.service";
import { KafkaPayload } from "@services/kafka/kafka.message";
import { SigFoxGroup } from "@entities/sigfox-group.entity";
import { CreateGatewayDto } from "@dto/chirpstack/create-gateway.dto";
import { SigFoxApiDeviceContent } from "@dto/sigfox/external/sigfox-api-device-response.dto";
import { DeviceModel } from "@entities/device-model.entity";
import { OpenDataDkDataset } from "@entities/open-data-dk-dataset.entity";
import { ReceivedMessage } from "@entities/received-message.entity";
import { ReceivedMessageMetadata } from "@entities/received-message-metadata.entity";
import { CreateServiceProfileDto } from "@dto/chirpstack/create-service-profile.dto";
import { ServiceProfileDto } from "@dto/chirpstack/service-profile.dto";
import { CreateDeviceProfileDto } from "@dto/chirpstack/create-device-profile.dto";
import { DeviceProfileDto } from "@dto/chirpstack/device-profile.dto";
import { GenericChirpstackConfigurationService } from "@services/chirpstack/generic-chirpstack-configuration.service";
import { ListAllChirpstackApplicationsResponseDto } from "@dto/chirpstack/list-all-applications-response.dto";
import { CreateIoTDeviceDownlinkDto } from "@dto/create-iot-device-downlink.dto";
import { INestApplication, NotImplementedException } from "@nestjs/common";
import { CreateIoTDeviceDto } from "@dto/create-iot-device.dto";
import { IoTDeviceType } from "@enum/device-type.enum";
import { ActivationType } from "@enum/lorawan-activation-type.enum";
import { AuthenticatedRequest } from "@dto/internal/authenticated-request";
import { DeviceProfileService } from "@services/chirpstack/device-profile.service";
import { OrganizationApplicationAdminPermission } from "@entities/permissions/organization-application-admin-permission.entity";
import { OrganizationGatewayAdminPermission } from "@entities/permissions/organization-gateway-admin-permission.entity";
import { OrganizationUserAdminPermission } from "@entities/permissions/organization-user-admin-permission.entity";

export async function clearDatabase(): Promise<void> {
    await getManager().query(
        `DELETE FROM "iot_device_payload_decoder_data_target_connection"; \n` +
            `DELETE FROM "open_data_dk_dataset"; \n` +
            `DELETE FROM "received_message"; \n` +
            `DELETE FROM "iot_device"; \n` +
            `DELETE FROM "device_model"; \n` +
            `DELETE FROM "application"; \n` +
            `DELETE FROM "data_target"; \n` +
            `DELETE FROM "received_message_metadata";  \n` +
            `DELETE FROM "payload_decoder";  \n` +
            `DELETE FROM "user_permissions_permission";  \n` +
            `DELETE FROM "application_permissions_permission";  \n` +
            `DELETE FROM "permission";  \n` +
            `DELETE FROM "organization";  \n` +
            `DELETE FROM "sigfox_group";  \n` +
            `DELETE FROM "user";  \n`
    );
}

export function generateSigfoxDeviceFromData(
    application: Application,
    backendDevice: SigFoxApiDeviceContent
): SigFoxDevice {
    const sigfoxDevice = new SigFoxDevice();
    sigfoxDevice.name = "E2E Test SigFox Device";
    sigfoxDevice.application = application;
    sigfoxDevice.deviceId = backendDevice.id;
    sigfoxDevice.deviceTypeId = backendDevice.deviceType.id;
    sigfoxDevice.groupId = backendDevice.group.id;
    sigfoxDevice.metadata = JSON.parse('""');

    return sigfoxDevice;
}

export async function generateSavedReceivedMessageAndMetadata(
    iotDevice: IoTDevice,
    payloadString = LORAWAN_PAYLOAD
): Promise<ReceivedMessage> {
    const now = new Date();
    const messageTime = now.valueOf() - 10;

    const metadata = new ReceivedMessageMetadata();
    metadata.sentTime = new Date(messageTime);
    metadata.device = iotDevice;
    const metadata2 = new ReceivedMessageMetadata();
    metadata2.sentTime = new Date(now.valueOf() - 24 * 60 * 60);
    metadata2.device = iotDevice;
    await getManager().save([metadata, metadata2]);

    const receivedMessage = new ReceivedMessage();
    receivedMessage.device = iotDevice;
    receivedMessage.rawData = JSON.parse(payloadString);
    receivedMessage.sentTime = new Date(messageTime);
    return await getManager().save(receivedMessage);
}

export async function generateSavedSigfoxDeviceFromData(
    application: Application,
    backendDevice: SigFoxApiDeviceContent
): Promise<SigFoxDevice> {
    const device = generateSigfoxDeviceFromData(application, backendDevice);
    return await getManager().save(device);
}

export async function generateSavedSigFoxGroup(org: Organization): Promise<SigFoxGroup> {
    return await getManager().save(generateSigFoxGroup(org));
}

export function generateSigFoxGroup(org: Organization): SigFoxGroup {
    const sigfoxGroup = new SigFoxGroup();
    sigfoxGroup.username = "5f2d1069e833d903621ff237";
    sigfoxGroup.password = "73cf3fdbd66bf62f1c4180b68f707135";
    sigfoxGroup.sigfoxGroupId = "5e74c24476600f14bab7e0bd";
    sigfoxGroup.belongsTo = org;
    return sigfoxGroup;
}

export function generateValidJwtForUser(user: User): string {
    const jwtService = new JwtService({
        secret: "secretKey-os2iot-secretKey",
        signOptions: { expiresIn: "9h" },
    });
    const payload: JwtPayloadDto = { username: user.email, sub: user.id };
    return jwtService.sign(payload);
}

export function generateGlobalAdminPermission(): GlobalAdminPermission {
    return new GlobalAdminPermission();
}

export async function generateSavedGlobalAdminPermission(): Promise<
    GlobalAdminPermission
> {
    return await getManager().save(generateGlobalAdminPermission());
}

// TODO: Due to the changes in permissions, these are no longer valid.
// See generateSavedOrganizationAdminUser()
// export function generateOrganizationAdminPermission(
//     org: Organization
// ): OrganizationAdminPermission {
//     return new OrganizationAdminPermission("E2E Test - Org admin", org);
// }

// export async function generateSavedOrganizationAdminPermission(
//     org: Organization
// ): Promise<OrganizationAdminPermission> {
//     return await getManager().save(generateOrganizationAdminPermission(org));
// }

export function generateDeviceModel(
    org: Organization,
    name = "myDevice Sensor for Containers 345"
): DeviceModel {
    const model = new DeviceModel();
    model.belongsTo = org;
    model.body = JSON.parse(`{
      "id": "myDevice-wastecontainer-sensor-345",
      "name": "${name}",
      "type": "DeviceModel",
      "category": ["sensor"],
      "function": ["sensing"],
      "brandName": "myDevice",
      "modelName": "S4Container 345",
      "manufacturerName": "myDevice Inc.",
      "controlledProperty": ["fillingLevel", "temperature"]
    }`);

    return model;
}

export async function generateSavedDeviceModel(
    org: Organization,
    name = "myDevice Sensor for Containers 345"
): Promise<DeviceModel> {
    return await getManager().save(generateDeviceModel(org, name));
}

export function generateOrganization(name?: string): Organization {
    const org = new Organization();
    org.name = name ? name : "E2E Test Organization";
    org.applications = [];
    org.payloadDecoders = [];
    org.sigfoxGroups = [];
    org.deviceModels = [];

    const READ_SUFFIX = " - Read";
    const APP_ADMIN_SUFFIX = " - OrganizationAppAdmin";
    const GATEWAY_ADMIN_SUFFIX = " - OrganizationGatewayAdmin";
    const USER_ADMIN_SUFFIX = " - OrganizationUserAdmin";

    const readPermission = new ReadPermission(org.name + READ_SUFFIX, org, true);
    const appAdminPermission = new OrganizationApplicationAdminPermission(org.name + APP_ADMIN_SUFFIX, org, true);
    const gatewayAdminPermission = new OrganizationGatewayAdminPermission(org.name + GATEWAY_ADMIN_SUFFIX, org);
    const userAdminPermission = new OrganizationUserAdminPermission(org.name + USER_ADMIN_SUFFIX, org);
    org.permissions = [
        appAdminPermission,
        gatewayAdminPermission,
        userAdminPermission,
        readPermission,
    ];

    return org;
}

export async function generateSavedOrganization(name?: string): Promise<Organization> {
    const org = generateOrganization(name);
    const savedOrg = await getManager().save(org);
    await getManager().save(org.permissions);
    return savedOrg;
}

export async function generateSavedKombitUser(nameID: string): Promise<User> {
    return await getManager().save(generateKombitUser(nameID));
}

export function generateKombitUser(nameID: string): User {
    const user = new User();
    user.name = nameID.split(",").find(x => x.startsWith("CN"));
    user.nameId = nameID;
    user.email = null;
    user.active = true;
    user.passwordHash = null;
    user.permissions = [];

    return user;
}

export function generateUser(permissions: Permission[]): User {
    const user = new User();
    user.name = `TestUser${randomMacAddress()}`;
    user.email = `${user.name}@test.test`;
    user.active = true;
    // Password is 'hunter2', but saving the hash since it takes ~100 ms (by design) to generate the hash.
    user.passwordHash = "$2a$10$ypJWMZzMokzdq/gaNYsNieDTCjSCYyzpBzEtyqXDd5VVW1STbmXT2";
    user.permissions = permissions;

    return user;
}

export async function generateSavedGlobalAdminUser(): Promise<User> {
    const globalAdmin = await generateSavedGlobalAdminPermission();
    const user = await getManager().save(generateUser([globalAdmin]));

    return user;
}

export async function generateSavedOrganizationAdminUser(
    org: Organization
): Promise<User> {
    // let orgAdmin = org.permissions.find(x => x.type == PermissionType.OrganizationAdmin);
    // if (!orgAdmin) {
    //     orgAdmin = await generateSavedOrganizationAdminPermission(org);
    // }
    // const user = await getManager().save(generateUser([orgAdmin]));

    // return user;

    // TODO: Due to the changes in permissions, this test is no longer valid
    // Tests aren't used anymore. Instead of "fixing" it, we throw an exception to raise awareness
    throw new NotImplementedException();
}

export async function generateSavedReadWriteUser(org: Organization): Promise<User> {
    const appAdminPerm = org.permissions.find(x => x.type.some(({ type }) => type === PermissionType.OrganizationApplicationAdmin));
    const gatewayAdminPerm = org.permissions.find(x => x.type.some(({ type }) => type === PermissionType.OrganizationGatewayAdmin));
    const userAdminPerm = org.permissions.find(x => x.type.some(({ type }) => type === PermissionType.OrganizationUserAdmin));
    const readPerm = org.permissions.find(x => x.type.some(({ type }) => type === PermissionType.Read));
    return await getManager().save(
        generateUser([appAdminPerm, gatewayAdminPerm, userAdminPerm, readPerm])
    );
}

export function generateApplication(org?: Organization, name?: string): Application {
    const app = new Application();
    app.name = "E2E Test Application" + name;
    app.description = "E2E Test Application Description";
    app.iotDevices = [];
    app.dataTargets = [];
    app.belongsTo = org;

    return app;
}

export async function generateSavedApplication(
    org?: Organization,
    name?: string
): Promise<Application> {
    let app;
    if (org) {
        app = generateApplication(org, name);
    } else {
        const org = await generateSavedOrganization();
        app = generateApplication(org, name);
    }
    return await getManager().save(app);
}

export const SIGFOX_DEVICE_ID = "B445A9";
export const SIGFOX_DEVICE_ID_2 = "B443A5";
export const SIGFOX_DEVICE_TYPE_ID = "5e74c318aa8aec41f9cc6b8d";
export function generateSigfoxDevice(
    application: Application,
    nameSuffix = ""
): SigFoxDevice {
    const sigfoxDevice = new SigFoxDevice();
    sigfoxDevice.name = "E2E Test SigFox Device" + nameSuffix;
    sigfoxDevice.application = application;
    sigfoxDevice.deviceId = SIGFOX_DEVICE_ID;
    sigfoxDevice.deviceTypeId = SIGFOX_DEVICE_TYPE_ID;
    sigfoxDevice.metadata = JSON.parse('""');

    return sigfoxDevice;
}

export async function generateSavedSigfoxDevice(
    app: Application,
    nameSuffix?: string
): Promise<SigFoxDevice> {
    return await getManager().save(generateSigfoxDevice(app, nameSuffix));
}

export function generateIoTDevice(applications: Application): IoTDevice {
    const device = new GenericHTTPDevice();
    device.name = "E2E Test GENERIC HTTP device";
    device.application = applications;
    device.apiKey = "DUMMY-API-KEY";
    device.metadata = JSON.parse('{"some_key": "a_value"}');
    device.id = 1;

    return device;
}

export async function generateSavedIoTDevice(
    applications: Application
): Promise<IoTDevice> {
    return await getManager().save(generateIoTDevice(applications));
}

export function generateHttpDevice(
    applications: Application,
    nameSuffix = ""
): GenericHTTPDevice {
    const device = new GenericHTTPDevice();
    device.name = "E2E Test GENERIC HTTP device" + nameSuffix;
    device.application = applications;
    device.apiKey = "DUMMY-API-KEY";
    device.metadata = JSON.parse('{"some_key": "a_value"}');
    device.id = 1;

    return device;
}

export async function generateSavedHttpDevice(
    applications: Application,
    nameSuffix?: string
): Promise<GenericHTTPDevice> {
    return await getManager().save(generateHttpDevice(applications, nameSuffix));
}

export function generateLoRaWANDevice(
    applications: Application,
    nameSuffix = ""
): LoRaWANDevice {
    const device = new LoRaWANDevice();
    device.name = "E2E Test LoRaWAN device" + nameSuffix;
    device.application = applications;
    device.metadata = JSON.parse('{"some_key": "a_value"}');
    device.id = 1;
    device.deviceEUI = "A81758FFFE042E82";

    return device;
}

export async function generateSavedLoRaWANDevice(
    applications: Application,
    nameSuffix?: string
): Promise<LoRaWANDevice> {
    return await getManager().save(generateLoRaWANDevice(applications, nameSuffix));
}

export function generateLoRaWanDownlink(): CreateIoTDeviceDownlinkDto {
    return {
        data: "3E0A14000000461700000002",
        port: 6,
        confirmed: true,
    };
}

export async function generateSavedDataTarget(
    application: Application,
    url?: string
): Promise<HttpPushDataTarget> {
    return await getManager().save(generateDataTarget(application, url));
}

export async function generateSavedDataTargetWithOpenDataDk(
    application: Application,
    url?: string,
    minimal = false
): Promise<HttpPushDataTarget> {
    return await getManager().save(
        generateDataTargetWithOpenDataDk(application, url, minimal),
        {
            reload: true,
        }
    );
}

export function generateDataTarget(
    application: Application,
    url?: string
): HttpPushDataTarget {
    const dataTarget = new HttpPushDataTarget();
    dataTarget.name = "E2E Test Http Push Data Target";
    dataTarget.url = url ? url : "https://enwehrrtrqajd1m.m.pipedream.net";
    dataTarget.application = application;
    dataTarget.timeout = 30000;

    return dataTarget;
}

export function generateDataTargetWithOpenDataDk(
    application: Application,
    url?: string,
    minimal?: boolean
): HttpPushDataTarget {
    const dataTarget = new HttpPushDataTarget();
    dataTarget.name = "E2E Test Http Push Data Target";
    dataTarget.url = url ? url : "https://enwehrrtrqajd1m.m.pipedream.net";
    dataTarget.application = application;
    dataTarget.timeout = 30000;
    dataTarget.openDataDkDataset = new OpenDataDkDataset();
    dataTarget.openDataDkDataset.name = "E2E";
    dataTarget.openDataDkDataset.description = minimal ? "" : "e2e";
    dataTarget.openDataDkDataset.keywords = minimal ? [] : ["etKeyWord"];
    dataTarget.openDataDkDataset.license =
        "http://portal.opendata.dk/dataset/open-data-dk-licens";
    dataTarget.openDataDkDataset.authorName = "E2E";
    dataTarget.openDataDkDataset.authorEmail = "e2e@test.dk";
    dataTarget.openDataDkDataset.resourceTitle = minimal ? "" : "Rumsensor2";
    return dataTarget;
}

export async function generateSavedConnection(
    iotDevice: IoTDevice,
    dataTarget: DataTarget,
    payloadDecoder?: PayloadDecoder
): Promise<IoTDevicePayloadDecoderDataTargetConnection> {
    const connection = new IoTDevicePayloadDecoderDataTargetConnection();
    connection.dataTarget = dataTarget;
    connection.iotDevices = [iotDevice];
    connection.payloadDecoder = payloadDecoder;
    return await getManager().save(connection);
}

export function generatePayloadDecoder(
    org?: Organization,
    includeDeviceModel = false
): PayloadDecoder {
    const decoder = new PayloadDecoder();
    decoder.organization = org;
    decoder.name = "E2E Test Payload Decoder";
    decoder.decodingFunction = `const TYPE_TEMP = 0x01; //temp 2 bytes -3276.8°C -->3276.7°C
    const TYPE_RH = 0x02; //Humidity 1 byte  0-100%
    const TYPE_ACC = 0x03; //acceleration 3 bytes X,Y,Z -128 --> 127 +/-63=1G
    const TYPE_LIGHT = 0x04; //Light 2 bytes 0-->65535 Lux
    const TYPE_MOTION = 0x05; //No of motion 1 byte  0-255
    const TYPE_CO2 = 0x06; //Co2 2 bytes 0-65535 ppm
    const TYPE_VDD = 0x07; //VDD 2byte 0-65535mV
    const TYPE_ANALOG1 = 0x08; //VDD 2byte 0-65535mV
    const TYPE_GPS = 0x09; //3bytes lat 3bytes long binary
    const TYPE_PULSE1 = 0x0a; //2bytes relative pulse count
    const TYPE_PULSE1_ABS = 0x0b; //4bytes no 0->0xFFFFFFFF
    const TYPE_EXT_TEMP1 = 0x0c; //2bytes -3276.5C-->3276.5C
    const TYPE_EXT_DIGITAL = 0x0d; //1bytes value 1 or 0
    const TYPE_EXT_DISTANCE = 0x0e; //2bytes distance in mm
    const TYPE_ACC_MOTION = 0x0f; //1byte number of vibration/motion
    const TYPE_IR_TEMP = 0x10; //2bytes internal temp 2bytes external temp -3276.5C-->3276.5C
    const TYPE_OCCUPANCY = 0x11; //1byte data
    const TYPE_WATERLEAK = 0x12; //1byte data 0-255
    const TYPE_GRIDEYE = 0x13; //65byte temperature data 1byte ref+64byte external temp
    const TYPE_PRESSURE = 0x14; //4byte pressure data (hPa)
    const TYPE_SOUND = 0x15; //2byte sound data (peak/avg)
    const TYPE_PULSE2 = 0x16; //2bytes 0-->0xFFFF
    const TYPE_PULSE2_ABS = 0x17; //4bytes no 0->0xFFFFFFFF
    const TYPE_ANALOG2 = 0x18; //2bytes voltage in mV
    const TYPE_EXT_TEMP2 = 0x19; //2bytes -3276.5C-->3276.5C
    const TYPE_EXT_DIGITAL2 = 0x1a; // 1bytes value 1 or 0
    const TYPE_EXT_ANALOG_UV = 0x1b; // 4 bytes signed int (uV)
    const TYPE_DEBUG = 0x3d; // 4bytes debug

    function bin16dec(bin) {
      var num = bin & 0xffff;
      if (0x8000 & num) num = -(0x010000 - num);
      return num;
    }

    function bin8dec(bin) {
      var num = bin & 0xff;
      if (0x80 & num) num = -(0x0100 - num);
      return num;
    }

    function base64ToBytes(str) {
      return atob(str)
        .split("")
        .map(function (c) {
          return c.charCodeAt(0);
        });
    }

    function hexToBytes(hex) {
      for (var bytes = [], c = 0; c < hex.length; c += 2)
        bytes.push(parseInt(hex.substr(c, 2), 16));
      return bytes;
    }

    function DecodeElsysPayload(data) {
      var obj = new Object();
      for (i = 0; i < data.length; i++) {
        console.log(data[i]);
        switch (data[i]) {
          case TYPE_TEMP: //Temperature
            var temp = (data[i + 1] << 8) | data[i + 2];
            temp = bin16dec(temp);
            obj.temperature = temp / 10;
            i += 2;
            break;
          case TYPE_RH: //Humidity
            var rh = data[i + 1];
            obj.humidity = rh;
            i += 1;
            break;
          case TYPE_ACC: //Acceleration
            obj.x = bin8dec(data[i + 1]);
            obj.y = bin8dec(data[i + 2]);
            obj.z = bin8dec(data[i + 3]);
            i += 3;
            break;
          case TYPE_LIGHT: //Light
            obj.light = (data[i + 1] << 8) | data[i + 2];
            i += 2;
            break;
          case TYPE_MOTION: //Motion sensor(PIR)
            obj.motion = data[i + 1];
            i += 1;
            break;
          case TYPE_CO2: //CO2
            obj.co2 = (data[i + 1] << 8) | data[i + 2];
            i += 2;
            break;
          case TYPE_VDD: //Battery level
            obj.vdd = (data[i + 1] << 8) | data[i + 2];
            i += 2;
            break;
          case TYPE_ANALOG1: //Analog input 1
            obj.analog1 = (data[i + 1] << 8) | data[i + 2];
            i += 2;
            break;
          case TYPE_GPS: //gps
            i++;
            obj.lat =
              (data[i + 0] |
                (data[i + 1] << 8) |
                (data[i + 2] << 16) |
                (data[i + 2] & 0x80 ? 0xff << 24 : 0)) /
              10000;
            obj.long =
              (data[i + 3] |
                (data[i + 4] << 8) |
                (data[i + 5] << 16) |
                (data[i + 5] & 0x80 ? 0xff << 24 : 0)) /
              10000;
            i += 5;
            break;
          case TYPE_PULSE1: //Pulse input 1
            obj.pulse1 = (data[i + 1] << 8) | data[i + 2];
            i += 2;
            break;
          case TYPE_PULSE1_ABS: //Pulse input 1 absolute value
            var pulseAbs =
              (data[i + 1] << 24) |
              (data[i + 2] << 16) |
              (data[i + 3] << 8) |
              data[i + 4];
            obj.pulseAbs = pulseAbs;
            i += 4;
            break;
          case TYPE_EXT_TEMP1: //External temp
            var temp = (data[i + 1] << 8) | data[i + 2];
            temp = bin16dec(temp);
            obj.externalTemperature = temp / 10;
            i += 2;
            break;
          case TYPE_EXT_DIGITAL: //Digital input
            obj.digital = data[i + 1];
            i += 1;
            break;
          case TYPE_EXT_DISTANCE: //Distance sensor input
            obj.distance = (data[i + 1] << 8) | data[i + 2];
            i += 2;
            break;
          case TYPE_ACC_MOTION: //Acc motion
            obj.accMotion = data[i + 1];
            i += 1;
            break;
          case TYPE_IR_TEMP: //IR temperature
            var iTemp = (data[i + 1] << 8) | data[i + 2];
            iTemp = bin16dec(iTemp);
            var eTemp = (data[i + 3] << 8) | data[i + 4];
            eTemp = bin16dec(eTemp);
            obj.irInternalTemperature = iTemp / 10;
            obj.irExternalTemperature = eTemp / 10;
            i += 4;
            break;
          case TYPE_OCCUPANCY: //Body occupancy
            obj.occupancy = data[i + 1];
            i += 1;
            break;
          case TYPE_WATERLEAK: //Water leak
            obj.waterleak = data[i + 1];
            i += 1;
            break;
          case TYPE_GRIDEYE: //Grideye data
            var ref = data[i + 1];
            i++;
            obj.grideye = [];
            for (var j = 0; j < 64; j++) {
              obj.grideye[j] = ref + data[1 + i + j] / 10.0;
            }
            i += 64;
            break;
          case TYPE_PRESSURE: //External Pressure
            var temp =
              (data[i + 1] << 24) |
              (data[i + 2] << 16) |
              (data[i + 3] << 8) |
              data[i + 4];
            obj.pressure = temp / 1000;
            i += 4;
            break;
          case TYPE_SOUND: //Sound
            obj.soundPeak = data[i + 1];
            obj.soundAvg = data[i + 2];
            i += 2;
            break;
          case TYPE_PULSE2: //Pulse 2
            obj.pulse2 = (data[i + 1] << 8) | data[i + 2];
            i += 2;
            break;
          case TYPE_PULSE2_ABS: //Pulse input 2 absolute value
            obj.pulseAbs2 =
              (data[i + 1] << 24) |
              (data[i + 2] << 16) |
              (data[i + 3] << 8) |
              data[i + 4];
            i += 4;
            break;
          case TYPE_ANALOG2: //Analog input 2
            obj.analog2 = (data[i + 1] << 8) | data[i + 2];
            i += 2;
            break;
          case TYPE_EXT_TEMP2: //External temp 2
            var temp = (data[i + 1] << 8) | data[i + 2];
            temp = bin16dec(temp);
            if (typeof obj.externalTemperature2 === "number") {
              obj.externalTemperature2 = [obj.externalTemperature2];
            }
            if (typeof obj.externalTemperature2 === "object") {
              obj.externalTemperature2.push(temp / 10);
            } else {
              obj.externalTemperature2 = temp / 10;
            }
            i += 2;
            break;
          case TYPE_EXT_DIGITAL2: //Digital input 2
            obj.digital2 = data[i + 1];
            i += 1;
            break;
          case TYPE_EXT_ANALOG_UV: //Load cell analog uV
            obj.analogUv =
              (data[i + 1] << 24) |
              (data[i + 2] << 16) |
              (data[i + 3] << 8) |
              data[i + 4];
            i += 4;
            break;
          default:
            //somthing is wrong with data
            i = data.length;
            break;
        }
      }
      return obj;
    }

    function decode(payload, metadata) {
      let res = {};
      res.decoded = DecodeElsysPayload(base64ToBytes(payload.data));
      ${includeDeviceModel ? "res.deviceModel = metadata.deviceModel.body;" : ""}
      return res;
    }
    `;

    return decoder;
}

export async function generateSavedPayloadDecoder(
    org?: Organization,
    includeDeviceModel = false
): Promise<PayloadDecoder> {
    const decoder = generatePayloadDecoder(org, includeDeviceModel);
    return await getManager().save(decoder);
}

export function generateLoRaWANRawRequestDto(iotDeviceId?: number): RawRequestDto {
    return {
        rawPayload: JSON.parse(`{
            "data": "AQEXAjEEAIsFCAcOPQ==",
            "freq": 867100000,
            "chan": 3,
            "tmst": 71333956,
            "utmms": 1597675976328,
            "rfch": 0,
            "stat": 1,
            "rssi": -39,
            "size": 26,
            "modu": "LORA",
            "datr": "SF12BW125",
            "codr": "4/5",
            "lsnr": 12
        }`),
        iotDeviceId: iotDeviceId || 1,
        unixTimestamp: 1596921546,
        type: IoTDeviceType.LoRaWAN,
    };
}

export const LORAWAN_PAYLOAD = `{
  "data": "AQEXAjEEAIsFCAcOPQ==",
  "freq": 867100000,
  "chan": 3,
  "tmst": 71333956,
  "utmms": 1597675976328,
  "rfch": 0,
  "stat": 1,
  "rssi": -39,
  "size": 26,
  "modu": "LORA",
  "datr": "SF12BW125",
  "codr": "4/5",
  "lsnr": 12
}`;

export const SIGFOX_PAYLOAD_2 = `{
  "time": 1600674364,
  "deviceTypeId": "${SIGFOX_DEVICE_TYPE_ID}",
  "deviceId": "${SIGFOX_DEVICE_ID}",
  "snr": 6.00,
  "rssi": -128.00,
  "station": "93CF",
  "data": "ce20000046003f0f8004223c",
  "seqNumber": 49
  }`;

export const SIGFOX_PAYLOAD = `{
  "time": 1602167366,
  "deviceTypeId": "${SIGFOX_DEVICE_TYPE_ID}",
  "deviceId": "${SIGFOX_DEVICE_ID}",
  "snr": 13.00,
  "rssi": -119.00,
  "station": "2406",
  "data": "be099471",
  "seqNumber": 486
}`;

export function generateSigfoxRawRequestDto(iotDeviceId?: number): RawRequestDto {
    return {
        rawPayload: JSON.parse(SIGFOX_PAYLOAD),
        iotDeviceId: iotDeviceId || 1,
        unixTimestamp: 1596721546,
        type: IoTDeviceType.SigFox,
    };
}

export function generateRawRequestSigfoxKafkaPayload(iotDeviceId?: number): KafkaPayload {
    return {
        body: generateSigfoxRawRequestDto(iotDeviceId),
        messageId: "genericHttp1596721546",
        messageType: "receiveData.genericHttp",
        topicName: KafkaTopic.RAW_REQUEST,
    };
}

export function generateRawRequestLoRaWANKafkaPayload(
    iotDeviceId?: number
): KafkaPayload {
    return {
        body: generateLoRaWANRawRequestDto(iotDeviceId),
        messageId: "genericHttp1596721546",
        messageType: "receiveData.genericHttp",
        topicName: KafkaTopic.RAW_REQUEST,
    };
}

export async function getNetworkServerId(
    chirpstackSetupNetworkServerService: ChirpstackSetupNetworkServerService
): Promise<string> {
    let id: string;
    await chirpstackSetupNetworkServerService
        .getNetworkServers(1000, 0)
        .then(response => {
            response.result.forEach(element => {
                if (element.name === "OS2iot") {
                    id = element.id.toString();
                }
            });
        });
    return id;
}

export function randomMacAddress(): string {
    const n = Math.floor(Math.random() * 0xffffff * 100000).toString(16);
    return n.padStart(16, "0");
}

export async function makeCreateGatewayDto(
    chirpstackSetupNetworkServerService: ChirpstackSetupNetworkServerService,
    org?: Organization
): Promise<CreateGatewayDto> {
    const mac = randomMacAddress();
    const networkServerId = await getNetworkServerId(chirpstackSetupNetworkServerService);
    // Logger.log(mac);
    const request: CreateGatewayDto = {
        gateway: {
            id: mac,
            location: {
                latitude: 12.34,
                longitude: 43.21,
            },
            discoveryEnabled: false,
            name: `${gatewayNamePrefix}-${mac}`,
            description: "E2E test description",
            networkServerID: networkServerId,
            organizationID: "1",
            tagsString: '{ "asdf": "abcd" }',
        },
        organizationId: org?.id != null ? org?.id : 1,
    };
    return request;
}

export const gatewayNamePrefix = "E2E-test";

export function createServiceProfileData(testname = "e2e"): CreateServiceProfileDto {
    const serviceProfileDto: ServiceProfileDto = {
        name: testname,
        prAllowed: true,
        raAllowed: true,
        reportDevStatusBattery: true,
        reportDevStatusMargin: true,
        ulRatePolicy: "DROP",
        addGWMetaData: true,
        devStatusReqFreq: 0,
        dlBucketSize: 0,
        dlRate: 0,
        drMax: 0,
        drMin: 0,
        hrAllowed: true,
        minGWDiversity: 0,
        nwkGeoLoc: true,
        targetPER: 0,
        ulBucketSize: 0,
        ulRate: 0,
    };

    const serviceProfile: CreateServiceProfileDto = {
        serviceProfile: serviceProfileDto,
    };

    return serviceProfile;
}

export function createDeviceProfileData(): CreateDeviceProfileDto {
    const deviceProfileDto: DeviceProfileDto = {
        name: "e2e" + randomMacAddress(),
        macVersion: "1.0.3",
        regParamsRevision: "A",
        maxEIRP: 1,
        geolocBufferTTL: 1,
        geolocMinBufferSize: 1,
        factoryPresetFreqs: [1, 2],
        supportsJoin: true,
    };

    const deviceProfile: CreateDeviceProfileDto = {
        deviceProfile: deviceProfileDto,
        internalOrganizationId: 1,
    };

    return deviceProfile;
}

export async function cleanChirpstackApplications(
    csService: GenericChirpstackConfigurationService,
    testname: string
): Promise<void> {
    await csService
        .get<ListAllChirpstackApplicationsResponseDto>(`applications?limit=1000`)
        .then(response => {
            response.result.forEach(async application => {
                if (application.serviceProfileName.startsWith(testname)) {
                    await csService.delete(`applications/${application.id}`);
                }
            });
        });
}

export async function cleanChirpstackDeviceProfiles(
    deviceProfileService: DeviceProfileService,
    testname: string,
    fakeUser: AuthenticatedRequest
): Promise<void> {
    await deviceProfileService.findAllDeviceProfiles(1000, 0).then(response => {
        response.result.forEach(async deviceProfile => {
            if (deviceProfile.name.startsWith(testname)) {
                await deviceProfileService.deleteDeviceProfile(
                    deviceProfile.id,
                    fakeUser
                );
            }
        });
    });
}

export async function createLoRaWANDeviceInChirpstack(
    app: INestApplication,
    globalAdminJwt: string,
    application: Application
): Promise<LoRaWANDevice> {
    const dpId = await request(app.getHttpServer())
        .post("/chirpstack/device-profiles/")
        .auth(globalAdminJwt, { type: "bearer" })
        .send(createDeviceProfileData())
        .expect(201)
        .expect("Content-Type", /json/)
        .then(response => {
            return response.body.id;
        });

    const spId = await request(app.getHttpServer())
        .post("/chirpstack/service-profiles/")
        .auth(globalAdminJwt, { type: "bearer" })
        .send(createServiceProfileData())
        .expect(201)
        .expect("Content-Type", /json/)
        .then(response => {
            return response.body.id;
        });

    const createDto: CreateIoTDeviceDto = {
        type: IoTDeviceType.LoRaWAN,
        longitude: 42,
        latitude: 42,
        lorawanSettings: {
            skipFCntCheck: false,
            fCntUp: 0,
            nFCntDown: 0,
            devEUI: randomMacAddress(),
            serviceProfileID: spId,
            deviceProfileID: dpId,
            OTAAapplicationKey: "13371337133713371337133713371337",
            activationType: ActivationType.OTAA,
        },
        applicationId: application.id,
        name: "e2e",
    };

    const device = await request(app.getHttpServer())
        .post("/iot-device/")
        .auth(globalAdminJwt, { type: "bearer" })
        .send(createDto)
        .then(response => {
            return response.body;
        });
    return device;
}
