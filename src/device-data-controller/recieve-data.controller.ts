import {
    Controller,
    Post,
    Header,
    Body,
    Get,
    NotFoundException,
    Param,
    HttpException,
    HttpStatus,
    Logger,
} from "@nestjs/common";
import * as http from "https";
import * as querystring from "querystring";
import { ApiTags, ApiOperation, ApiBadRequestResponse } from "@nestjs/swagger";
import { RecieveDataService } from "@services/recieve-data.service";
import { IoTDevice } from "@entities/iot-device.entity";
import { IoTDeviceService } from "@services/iot-device.service";
import { RecieveData } from "@entities/recieve-data.entity";
import { IoTDeviceController } from "@admin-controller/iot-device.controller";

@ApiTags("RecieveData")
@Controller("recieveData")
export class RecieveDataController {
    constructor(private iotDeviceService: IoTDeviceService) {}

    @Post()
    @Header("Cache-Control", "none")
    @ApiOperation({ summary: "Create a new RecieveData" })
    @ApiBadRequestResponse()
    async create(
        @Param("apiKey") apiKey: string,
        @Body() data: string
    ): Promise<void> {
        try {
            const device = await this.iotDeviceService.findAndValidateDeviceByApiKey(
                apiKey
            );
            Logger.log(data);

            if (device === null) {
                const httpException = new HttpException(
                    {
                        //Når device apiKey er forkert
                        //return "403 Forbidden";
                        status: HttpStatus.FORBIDDEN,
                        error: "403 Forbidden",
                        description: "403 Forbidden",
                    },
                    HttpStatus.FORBIDDEN
                );
                Logger.log(httpException);
                // Logger.log(device.apiKey);

                throw httpException;
            } else if (device !== null) {
                Logger.log(device);

                //TODO: 204 No Content - når recievedData er videresendt
                const httpException = new HttpException(
                    {
                        //return "204 No Content";
                        status: HttpStatus.NO_CONTENT,
                        error: "204 No Content",
                        description: "204 No Content",
                    },
                    HttpStatus.NO_CONTENT
                );
                Logger.log(httpException);
                throw httpException;
            }
        } catch (e) {
            throw e;
        }
    }
}
