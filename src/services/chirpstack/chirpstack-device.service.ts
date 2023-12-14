import { BadRequestException, Injectable, InternalServerErrorException, Logger } from "@nestjs/common";
import { ChirpstackDeviceActivationContentsDto } from "@dto/chirpstack/chirpstack-device-activation-response.dto";
import { ChirpstackDeviceContentsDto } from "@dto/chirpstack/chirpstack-device-contents.dto";
import { ChirpstackDeviceKeysContentDto } from "@dto/chirpstack/chirpstack-device-keys-response.dto";
import { ChirpstackSingleApplicationResponseDto } from "@dto/chirpstack/chirpstack-single-application-response.dto";
import { CreateChirpstackDeviceDto } from "@dto/chirpstack/create-chirpstack-device.dto";
import { ListAllDevicesResponseDto } from "@dto/chirpstack/list-all-devices-response.dto";
import { CreateLoRaWANSettingsDto } from "@dto/create-lorawan-settings.dto";
import { GenericChirpstackConfigurationService } from "@services/chirpstack/generic-chirpstack-configuration.service";
import { CreateChirpstackDeviceQueueItemDto } from "@dto/chirpstack/create-chirpstack-device-queue-item.dto";
import {
    DeviceDownlinkQueueResponseDto,
    DeviceQueueItem,
} from "@dto/chirpstack/chirpstack-device-downlink-queue-response.dto";
import { ErrorCodes } from "@enum/error-codes.enum";
import {
    ChirpstackDeviceResponseContents,
    ChirpstackManyDeviceResponseDto,
} from "@dto/chirpstack/chirpstack-many-device-response";
import { IoTDevice } from "@entities/iot-device.entity";
import { LoRaWANDeviceWithChirpstackDataDto } from "@dto/lorawan-device-with-chirpstack-data.dto";
import { ActivationType } from "@enum/lorawan-activation-type.enum";
import { ChirpstackDeviceId } from "@dto/chirpstack/chirpstack-device-id.dto";
import { ChirpstackApplicationResponseDto } from "@dto/chirpstack/chirpstack-application-response.dto";
import { LoRaWANStatsElementDto, LoRaWANStatsResponseDto } from "@dto/chirpstack/device/lorawan-stats.response.dto";
import { ConfigService } from "@nestjs/config";
import { DeviceProfileService } from "@services/chirpstack/device-profile.service";

import { ServiceError } from "@grpc/grpc-js";
import { GetApplicationRequest, GetApplicationResponse } from "@chirpstack/chirpstack-api/api/application_pb";
import {
    ActivateDeviceRequest,
    CreateDeviceKeysRequest,
    CreateDeviceRequest,
    DeleteDeviceRequest,
    Device,
    DeviceActivation,
    DeviceKeys,
    DeviceQueueItem as DeviceQueueItemChirpstack,
    EnqueueDeviceQueueItemRequest,
    FlushDeviceQueueRequest,
    GetDeviceActivationRequest,
    GetDeviceActivationResponse,
    GetDeviceKeysRequest,
    GetDeviceKeysResponse,
    GetDeviceLinkMetricsRequest,
    GetDeviceLinkMetricsResponse,
    GetDeviceQueueItemsRequest,
    GetDeviceQueueItemsResponse,
    GetDeviceRequest,
    GetDeviceResponse,
    ListDevicesRequest,
    ListDevicesResponse,
    UpdateDeviceKeysRequest,
    UpdateDeviceRequest,
} from "@chirpstack/chirpstack-api/api/device_pb";
import { IdResponse } from "@interfaces/chirpstack-id-response.interface";
import { dateToTimestamp, timestampToDate } from "@helpers/date.helper";
import { Timestamp } from "google-protobuf/google/protobuf/timestamp_pb";
import { Aggregation } from "@chirpstack/chirpstack-api/common/common_pb";
import { DeviceMetricsDto, MetricProperties } from "@dto/chirpstack/chirpstack-device-metrics.dto";
import { LoRaWANDevice } from "@entities/lorawan-device.entity";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Application as DbApplication } from "@entities/application.entity";
import { IoTDeviceType } from "@enum/device-type.enum";
@Injectable()
export class ChirpstackDeviceService extends GenericChirpstackConfigurationService {
    @InjectRepository(DbApplication)
    private applicationRepository: Repository<DbApplication>;

    constructor(private configService: ConfigService, private deviceProfileService: DeviceProfileService) {
        super();

        this.deviceStatsIntervalInDays = configService.get<number>("backend.deviceStatsIntervalInDays");
    }

    private readonly logger = new Logger(ChirpstackDeviceService.name);

    DEVICE_NAME_PREFIX = "OS2IOT-";
    DEFAULT_DESCRIPTION = "Created by OS2IoT";
    private readonly deviceStatsIntervalInDays: number;

    public makeCreateChirpstackDeviceDto(dto: CreateLoRaWANSettingsDto, name: string): CreateChirpstackDeviceDto {
        const csDto = new ChirpstackDeviceContentsDto();
        csDto.name = `${this.DEVICE_NAME_PREFIX}${name}`.toLowerCase();
        csDto.description = this.DEFAULT_DESCRIPTION;
        csDto.devEUI = dto.devEUI;
        csDto.deviceProfileID = dto.deviceProfileID;

        csDto.isDisabled = dto.isDisabled;
        csDto.skipFCntCheck = dto.skipFCntCheck;

        return { device: csDto };
    }

    public async overwriteDownlink(dto: CreateChirpstackDeviceQueueItemDto): Promise<IdResponse> {
        await this.deleteDownlinkQueue(dto.deviceQueueItem.devEUI);
        try {
            const req = new EnqueueDeviceQueueItemRequest();
            const queueItem = new DeviceQueueItemChirpstack();
            queueItem.setConfirmed(dto.deviceQueueItem.confirmed);
            queueItem.setData(dto.deviceQueueItem.data);
            queueItem.setDevEui(dto.deviceQueueItem.devEUI);
            queueItem.setFPort(dto.deviceQueueItem.fPort);
            req.setQueueItem(queueItem);

            const res = await this.postDownlink(req);
            return res;
        } catch (err) {
            const fcntError = "enqueue downlink payload error: get next downlink fcnt for deveui error";
            if (err?.response?.data?.error?.startsWith(fcntError)) {
                throw new BadRequestException(ErrorCodes.DeviceIsNotActivatedInChirpstack);
            }

            throw err;
        }
    }

    public async deleteDevice(deviceEUI: string): Promise<void> {
        try {
            const req = new DeleteDeviceRequest();
            req.setDevEui(deviceEUI);
            await this.delete(`devices`, this.deviceServiceClient, req);
        } catch (err) {
            throw err;
        }
    }

    public async getDownlinkQueue(deviceEUI: string): Promise<DeviceDownlinkQueueResponseDto> {
        const req = new GetDeviceQueueItemsRequest();
        req.setDevEui(deviceEUI);
        const res = await this.getQueue(req);

        const queueItems: DeviceQueueItem[] = res.getResultList().map(queueItem => {
            return {
                confirmed: queueItem.getConfirmed(),
                devEUI: queueItem.getDevEui(),
                fCnt: queueItem.getFCntDown(),
                fPort: queueItem.getFPort(),
                data: queueItem.getData_asB64(),
            };
        });

        const responseDto: DeviceDownlinkQueueResponseDto = {
            totalCount: res.getTotalCount(),
            deviceQueueItems: queueItems,
        };
        return responseDto;
    }

    private async deleteDownlinkQueue(deviceEUI: string): Promise<void> {
        const req = new FlushDeviceQueueRequest();
        req.setDevEui(deviceEUI);
        await this.deleteQueue(req);
    }

    public async activateDeviceWithABP(
        devEUI: string,
        devAddr: string,
        fCntUp: number,
        nFCntDown: number,
        networkSessionKey: string,
        applicationSessionKey: string
    ): Promise<void> {
        const res = await this.createOrUpdateABPActivation(
            devAddr,
            networkSessionKey,
            applicationSessionKey,
            fCntUp,
            nFCntDown,
            devEUI
        );
        if (!res) {
            this.logger.warn(`Could not ABP activate Chirpstack Device using DEVEUI: ${devEUI}}`);
        }
    }

    public async getAllDevicesStatus(application: DbApplication): Promise<ChirpstackManyDeviceResponseDto> {
        const req = new ListDevicesRequest();
        if (!application.chirpstackId) {
            const loraDev = application.iotDevices.find(d => d.type === IoTDeviceType.LoRaWAN);
            const cast = loraDev as LoRaWANDevice;

            const deviceRequest = new GetDeviceRequest();
            deviceRequest.setDevEui(cast.deviceEUI);

            const getChirpstackDevice = await this.get<GetDeviceResponse>(
                "device",
                this.deviceServiceClient,
                deviceRequest
            );

            application.chirpstackId = getChirpstackDevice.getDevice().getApplicationId();
            await this.applicationRepository.save(application, {});
        }

        req.setApplicationId(application.chirpstackId);
        const devices = await this.getAllWithPagination<ListDevicesResponse.AsObject>(
            `devices`,
            10000,
            0,
            this.deviceServiceClient,
            req
        );

        const responseDevvice: ChirpstackDeviceResponseContents[] = devices.resultList.map(e => {
            return {
                devEUI: e.devEui,
                name: e.name,
                description: e.description,
                lastSeenAt: e.lastSeenAt ? timestampToDate(e.lastSeenAt) : undefined,
                deviceStatusBattery: e.deviceStatus?.batteryLevel,
                deviceStatusMargin: e.deviceStatus?.margin,
                deviceStatusExternalPowerSource: e.deviceStatus?.externalPowerSource,
                deviceProfileID: e.deviceProfileId,
                deviceProfileName: e.deviceProfileName,
            };
        });
        return {
            totalCount: devices.totalCount.toString(),
            result: responseDevvice,
        };
    }

    private async createOrUpdateABPActivation(
        devAddr: string,
        networkSessionKey: string,
        applicationSessionKey: string,
        fCntUp: number,
        nFCntDown: number,
        devEUI: string
    ) {
        const req = new ActivateDeviceRequest();
        const deviceActivation = this.mapActivationToChirpstack(
            devAddr,
            networkSessionKey,
            applicationSessionKey,
            fCntUp,
            nFCntDown,
            devEUI
        );
        req.setDeviceActivation(deviceActivation);
        try {
            await this.postActivation(req);
        } catch (e) {
            return false;
        }

        return true;
    }
    private mapActivationToChirpstack(
        devAddr: string,
        networkSessionKey: string,
        applicationSessionKey: string,
        fCntUp: number,
        nFCntDown: number,
        devEUI: string
    ) {
        const deviceActivation = new DeviceActivation();
        deviceActivation.setDevAddr(devAddr);
        deviceActivation.setNwkSEncKey(networkSessionKey);
        deviceActivation.setAppSKey(applicationSessionKey);
        deviceActivation.setFCntUp(fCntUp);
        deviceActivation.setNFCntDown(nFCntDown);
        deviceActivation.setDevEui(devEUI);
        deviceActivation.setFNwkSIntKey(networkSessionKey);
        deviceActivation.setSNwkSIntKey(networkSessionKey);
        return deviceActivation;
    }

    public async activateDeviceWithOTAA(deviceEUI: string, nwkKey: string, isUpdate: boolean): Promise<boolean> {
        try {
            if (isUpdate) {
                const req = new UpdateDeviceKeysRequest();
                const deviceKeys = this.mapDeviceKeysToChirpstack(deviceEUI, nwkKey);
                req.setDeviceKeys(deviceKeys);
                await this.putKeys(req);
            } else {
                const req = new CreateDeviceKeysRequest();
                const deviceKeys = this.mapDeviceKeysToChirpstack(deviceEUI, nwkKey);
                req.setDeviceKeys(deviceKeys);
                await this.postKeys(req);
            }
        } catch (e) {
            return false;
        }

        return true;
    }

    private mapDeviceKeysToChirpstack(deviceEUI: string, nwkKey: string) {
        const deviceKeys = new DeviceKeys();
        deviceKeys.setDevEui(deviceEUI);
        deviceKeys.setNwkKey(nwkKey);
        return deviceKeys;
    }

    public async createOrUpdateDevice(
        dto: CreateChirpstackDeviceDto,
        lorawanDevices: ChirpstackDeviceId[] = null
    ): Promise<boolean> {
        try {
            if (await this.isDeviceAlreadyCreated(dto.device.devEUI, lorawanDevices)) {
                const req = new UpdateDeviceRequest();
                const device = this.mapDeviceToChirpstack(dto);
                req.setDevice(device);
                await this.put(`devices`, this.deviceServiceClient, req);
            } else {
                const req = new CreateDeviceRequest();
                const device = this.mapDeviceToChirpstack(dto);
                req.setDevice(device);
                await this.post(`devices`, this.deviceServiceClient, req);
            }
        } catch (e) {
            this.logger.error(`Update or Post device got error: ${e}`);
            return false;
        }
        return true;
    }

    private mapDeviceToChirpstack(dto: CreateChirpstackDeviceDto): Device {
        const device = new Device();
        device.setApplicationId(dto.device.applicationID);
        device.setDescription(dto.device.description);
        device.setDevEui(dto.device.devEUI);
        device.setDeviceProfileId(dto.device.deviceProfileID);
        device.setIsDisabled(dto.device.isDisabled);
        device.setName(dto.device.name);
        device.setSkipFcntCheck(dto.device.skipFCntCheck);
        return device;
    }
    private async getChirpstackApplication(id: string): Promise<ChirpstackSingleApplicationResponseDto> {
        const req = new GetApplicationRequest();
        req.setId(id);
        try {
            const chirpstackApplicationResponse = await this.get<GetApplicationResponse>(
                `applications/${id}`,
                this.applicationServiceClient,
                req
            );
            const chirpstackApplication = chirpstackApplicationResponse.getApplication();
            const applicationDto = new ChirpstackApplicationResponseDto();

            applicationDto.name = chirpstackApplication.getName();
            applicationDto.description = chirpstackApplication.getDescription();
            applicationDto.id = chirpstackApplication.getId();
            applicationDto.tenantId = chirpstackApplication.getTenantId();

            const returnDto = new ChirpstackSingleApplicationResponseDto();
            returnDto.application = applicationDto;

            return returnDto;
        } catch (err) {
            throw new BadRequestException(ErrorCodes.CouldntGetApplications);
        }
    }

    public async getChirpstackDevice(id: string): Promise<ChirpstackDeviceContentsDto> {
        try {
            const req = new GetDeviceRequest();
            req.setDevEui(id);

            const res = await this.get<GetDeviceResponse>(`devices/${id}`, this.deviceServiceClient, req);
            const device = res.getDevice();

            const deviceDto: ChirpstackDeviceContentsDto = {
                deviceStatusBattery: res.getDeviceStatus()?.getBatteryLevel(),
                deviceStatusMargin: res.getDeviceStatus()?.getMargin(),
                devEUI: device.getDevEui(),
                deviceProfileID: device.getDeviceProfileId(),
                applicationID: device.getApplicationId(),
                description: device.getDescription(),
                isDisabled: device.getIsDisabled(),
                name: device.getName(),
                skipFCntCheck: device.getSkipFcntCheck(),
                tags: device.getTagsMap().toObject(),
                variables: device.getVariablesMap().toObject(),
            };

            return deviceDto;
        } catch (err) {
            throw new BadRequestException(ErrorCodes.CouldntGetApplications);
        }
    }

    private async getDeviceKeys(deviceId: string): Promise<ChirpstackDeviceKeysContentDto> {
        try {
            const req = new GetDeviceKeysRequest();
            req.setDevEui(deviceId);

            const res = (await this.getKeys(req)).getDeviceKeys();

            const keysDto: ChirpstackDeviceKeysContentDto = {
                appKey: res.getAppKey(),
                devEUI: res.getDevEui(),
                nwkKey: res.getNwkKey(),
            };

            return keysDto;
        } catch (err) {
            // Chirpstack returns 404 if keys are not saved ..
            // It seems like that the current logic is using this catch to see if the device is an ABP or OTAA device.
            return new ChirpstackDeviceKeysContentDto();
        }
    }

    private async getDeviceActivation(deviceId: string): Promise<ChirpstackDeviceActivationContentsDto> {
        try {
            const req = new GetDeviceActivationRequest();
            req.setDevEui(deviceId);

            const res = (await this.getActivation(req)).getDeviceActivation();

            const activationDto: ChirpstackDeviceActivationContentsDto = {
                aFCntDown: res.getAFCntDown(),
                devEUI: res.getDevEui(),
                appSKey: res.getAppSKey(),
                devAddr: res.getDevAddr(),
                fCntUp: res.getFCntUp(),
                fNwkSIntKey: res.getFNwkSIntKey(),
                nFCntDown: res.getAFCntDown(),
                nwkSEncKey: res.getNwkSEncKey(),
                sNwkSIntKey: res.getSNwkSIntKey(),
            };
            return activationDto;
        } catch (err) {
            return new ChirpstackDeviceActivationContentsDto();
        }
    }

    /**
     * Fetch and set LoRaWAN settings on the given device. This is not immutable.
     * @param iotDevice
     * @param applications
     * @returns The mutated device
     */
    public async enrichLoRaWANDevice(iotDevice: IoTDevice): Promise<LoRaWANDeviceWithChirpstackDataDto> {
        const loraDevice = iotDevice as LoRaWANDeviceWithChirpstackDataDto;
        loraDevice.lorawanSettings = new CreateLoRaWANSettingsDto();
        await this.mapActivationAndKeys(loraDevice);
        const csData = await this.getChirpstackDevice(loraDevice.deviceEUI);
        loraDevice.lorawanSettings.devEUI = csData.devEUI;
        loraDevice.lorawanSettings.deviceProfileID = csData.deviceProfileID;
        loraDevice.lorawanSettings.skipFCntCheck = csData.skipFCntCheck;
        loraDevice.lorawanSettings.isDisabled = csData.isDisabled;
        loraDevice.lorawanSettings.deviceStatusBattery = csData.deviceStatusBattery;
        loraDevice.lorawanSettings.deviceStatusMargin = csData.deviceStatusMargin;

        const deviceProfile = await this.deviceProfileService.findOneDeviceProfileById(csData.deviceProfileID);
        loraDevice.deviceProfileName = deviceProfile.deviceProfile.name;

        return loraDevice;
    }

    private async mapActivationAndKeys(loraDevice: LoRaWANDeviceWithChirpstackDataDto) {
        const keys = await this.getDeviceKeys(loraDevice.deviceEUI);
        if (keys.nwkKey) {
            // OTAA
            loraDevice.lorawanSettings.activationType = ActivationType.OTAA;
            loraDevice.lorawanSettings.OTAAapplicationKey = keys.nwkKey;
            loraDevice.OTAAapplicationKey = keys.nwkKey;
        } else {
            const activation = await this.getDeviceActivation(loraDevice.deviceEUI);
            if (activation.devAddr != null) {
                // ABP
                loraDevice.lorawanSettings.activationType = ActivationType.ABP;
                loraDevice.lorawanSettings.devAddr = activation.devAddr;
                loraDevice.lorawanSettings.fCntUp = activation.fCntUp;
                loraDevice.lorawanSettings.nFCntDown = activation.nFCntDown;
                loraDevice.lorawanSettings.networkSessionKey = activation.nwkSEncKey;
                loraDevice.lorawanSettings.applicationSessionKey = activation.appSKey;
            } else {
                loraDevice.lorawanSettings.activationType = ActivationType.NONE;
            }
        }
    }

    public async isDeviceAlreadyCreated(
        deviceEUI: string,
        chirpstackIds: ChirpstackDeviceId[] = null
    ): Promise<boolean> {
        const devices = !chirpstackIds ? await this.getAllChirpstackDevices() : chirpstackIds;
        const alreadyExists = devices.some(x => x.devEUI.toLowerCase() === deviceEUI.toLowerCase());
        return alreadyExists;
    }

    public async getStats(deviceEUI: string): Promise<LoRaWANStatsResponseDto> {
        const now = new Date();
        const to_time = dateToTimestamp(now);
        const from_time = new Date(new Date().setDate(now.getDate() - this.deviceStatsIntervalInDays));
        const from_time_timestamp: Timestamp = dateToTimestamp(from_time);

        const req = new GetDeviceLinkMetricsRequest();
        req.setDevEui(deviceEUI);
        req.setStart(from_time_timestamp);
        req.setEnd(to_time);
        req.setAggregation(Aggregation.DAY);
        const metaData = this.makeMetadataHeader();

        const getDeviceMetricsPromise = new Promise<GetDeviceLinkMetricsResponse>((resolve, reject) => {
            this.deviceServiceClient.getLinkMetrics(req, metaData, (err, resp) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(resp);
                }
            });
        });
        try {
            const metrics = await getDeviceMetricsPromise;
            return this.mapMetrics(metrics);
        } catch (err) {
            throw new BadRequestException(err);
        }
    }
    private mapMetrics(metrics: GetDeviceLinkMetricsResponse): LoRaWANStatsResponseDto {
        const statsElementDto: LoRaWANStatsElementDto[] = [];
        const deviceMetrics: DeviceMetricsDto = {};

        const rssiTimestamp = metrics.getGwRssi().getTimestampsList();
        const rssis = metrics
            .getGwRssi()
            .getDatasetsList()
            .find(e => e.getLabel() === "rssi")
            .getDataList();

        this.processPackets(rssiTimestamp, rssis, MetricProperties.rssi, deviceMetrics);

        const snrTimestamp = metrics.getGwSnr().getTimestampsList();
        const snr = metrics
            .getGwSnr()
            .getDatasetsList()
            .find(e => e.getLabel() === "snr")
            .getDataList();

        this.processPackets(snrTimestamp, snr, MetricProperties.snr, deviceMetrics);

        const drTimestamp = metrics.getRxPacketsPerDr().getTimestampsList();
        const drDatasets = metrics.getRxPacketsPerDr().getDatasetsList();

        drDatasets.forEach(drDataset => {
            const drLabel = drDataset.getLabel();
            const drData = drDataset.getDataList();
            this.processPackets(drTimestamp, drData, MetricProperties.dr, deviceMetrics, drLabel);
        });

        Object.keys(deviceMetrics).forEach(timestamp => {
            const packetCount = deviceMetrics[timestamp];
            const dto: LoRaWANStatsElementDto = {
                timestamp,
                gwRssi: packetCount.rssi,
                gwSnr: packetCount.snr,
                rxPacketsPerDr: packetCount.rxPacketsPerDr,
            };
            statsElementDto.push(dto);
        });
        return { result: statsElementDto };
    }
    private processPackets = (
        timestamps: Array<Timestamp>,
        packets: number[],
        key: string,
        packetCounts: DeviceMetricsDto,
        drLabel?: string
    ) => {
        timestamps.forEach((timestamp, index) => {
            const isoTimestamp = timestamp.toDate().toISOString();
            packetCounts[isoTimestamp] = packetCounts[isoTimestamp] || {
                rssi: 0,
                snr: 0,
                rxPacketsPerDr: {},
            };

            if (drLabel) {
                packetCounts[isoTimestamp].rxPacketsPerDr[drLabel as any] = packets[index];
            } else {
                (packetCounts[isoTimestamp] as any)[key] = packets[index];
            }
        });
    };

    //TODO:: FIX THIS!
    private async getAllChirpstackDevices(): Promise<ChirpstackDeviceContentsDto[]> {
        const req = new ListDevicesRequest();

        const devices = await this.getAllWithPagination<ListDevicesResponse.AsObject>(
            `devices`,
            1000,
            0,
            this.deviceServiceClient,
            req
        );

        const responseDevice: ChirpstackDeviceResponseContents[] = devices.resultList.map(e => {
            return {
                devEUI: e.devEui,
                name: e.name,
                description: e.description,
                lastSeenAt: e.lastSeenAt ? timestampToDate(e.lastSeenAt) : undefined,
                deviceStatusBattery: e.deviceStatus?.batteryLevel,
                deviceStatusMargin: e.deviceStatus?.margin,
                deviceStatusExternalPowerSource: e.deviceStatus?.externalPowerSource,
                deviceProfileID: e.deviceProfileId,
                deviceProfileName: e.deviceProfileName,
            };
        });

        return responseDevice;
    }

    private async getKeys(request: GetDeviceKeysRequest): Promise<GetDeviceKeysResponse> {
        return await this.makeRequest<GetDeviceKeysResponse>(
            request,
            this.deviceServiceClient.getKeys,
            "GET KEYS success",
            "GET KEYS failed and got error: "
        );
    }

    private async postKeys(request: CreateDeviceKeysRequest): Promise<void> {
        await this.makeRequest<void>(
            request,
            this.deviceServiceClient.createKeys,
            "POST KEYS success",
            "POST KEYS failed and got error: "
        );
    }

    private async putKeys(request: UpdateDeviceKeysRequest): Promise<void> {
        await this.makeRequest<void>(
            request,
            this.deviceServiceClient.updateKeys,
            "UPDATE KEYS success",
            "UPDATE KEYS failed and got error: "
        );
    }

    private async getQueue(request: GetDeviceQueueItemsRequest): Promise<GetDeviceQueueItemsResponse> {
        return await this.makeRequest<GetDeviceQueueItemsResponse>(
            request,
            this.deviceServiceClient.getQueue,
            "GET QUEUE success",
            "GET QUEUE failed and got error: "
        );
    }

    private async deleteQueue(request: FlushDeviceQueueRequest): Promise<void> {
        await this.makeRequest<void>(
            request,
            this.deviceServiceClient.flushQueue,
            "DELETE QUEUE success",
            "DELETE QUEUE failed and got error: "
        );
    }

    private async postDownlink(request: EnqueueDeviceQueueItemRequest): Promise<IdResponse> {
        return await this.makeRequest<IdResponse>(
            request,
            this.deviceServiceClient.enqueue,
            "POST DOWNLINK success",
            "POST DOWNLINK failed and got error :"
        );
    }

    private async getActivation(request: GetDeviceActivationRequest): Promise<GetDeviceActivationResponse> {
        return await this.makeRequest<GetDeviceActivationResponse>(
            request,
            this.deviceServiceClient.getActivation,
            "GET ACTIVATION success",
            "GET ACTIVATION failed and got error: "
        );
    }

    private async postActivation(request?: ActivateDeviceRequest): Promise<void> {
        await this.makeRequest<void>(
            request,
            this.deviceServiceClient.activate,
            "post ACTIVATION success",
            "GET activation failed and got error: "
        );
    }
    private async makeRequest<T>(
        request: any,
        method: (request: any, metaData: any, callback: (err: ServiceError, resp: any) => void) => void,
        successMessage: string,
        errorMessage: string
    ): Promise<T> {
        const metaData = this.makeMetadataHeader();
        const promise = new Promise<T>((resolve, reject) => {
            method.call(this.deviceServiceClient, request, metaData, (err: ServiceError, resp: any) => {
                if (err) {
                    reject(err);
                } else {
                    this.logger.debug(successMessage);
                    resolve(resp);
                }
            });
        });
        try {
            return await promise;
        } catch (err) {
            this.logger.error(errorMessage, +err);
            throw new InternalServerErrorException();
        }
    }
}
