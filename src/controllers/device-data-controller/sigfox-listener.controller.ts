import { SigFoxCallbackDto } from "@dto/sigfox/sigfox-callback.dto";
import {
    Body,
    Controller,
    HttpCode,
    Logger,
    NotFoundException,
    Post,
    Query,
} from "@nestjs/common";
import { ApiBadRequestResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import { IoTDeviceService } from "@services/iot-device.service";
import { BadRequestException } from "@nestjs/common";
import { ReceiveDataService } from "@services/data-management/receive-data.service";
import { IoTDeviceType } from "@enum/device-type.enum";

@ApiTags("SigFox")
@Controller("sigfox-callback")
export class SigFoxListenerController {
    constructor(
        private receiveDataService: ReceiveDataService,
        private iotDeviceService: IoTDeviceService
    ) {}

    private readonly logger = new Logger(SigFoxListenerController.name);

    @Post("data/uplink")
    @ApiOperation({ summary: "SigFox data callback endpoint." })
    @ApiBadRequestResponse()
    @HttpCode(204)
    async sigfoxCallback(
        @Query("apiKey") apiKey: string,
        @Body() data: SigFoxCallbackDto
    ): Promise<void> {
        if (apiKey != data?.deviceTypeId) {
            this.logger.error(
                `ApiKey(${apiKey}) did not match DeviceTypeId(${data?.deviceTypeId}`
            );
            throw new BadRequestException();
        }
        const iotDevice = await this.iotDeviceService.findSigFoxDeviceByDeviceIdAndDeviceTypeId(
            data.deviceId,
            data.deviceTypeId
        );

        if (!iotDevice) {
            this.logger.error(
                `Could not find SigFox device with id: '${data.deviceId}' and deviceType id: '${data.deviceTypeId}'`
            );
            throw new NotFoundException();
        }

        const dataAsString = JSON.stringify(data);
        await this.receiveDataService.sendToKafka(
            iotDevice,
            dataAsString,
            IoTDeviceType.SigFox.toString(),
            data.time
        );

        return;
    }
}