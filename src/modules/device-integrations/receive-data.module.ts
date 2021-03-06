import { HttpModule, Module } from "@nestjs/common";

import { ReceiveDataController } from "@device-data-controller/receive-data.controller";
import { ChirpstackAdministrationModule } from "@modules/device-integrations/chirpstack-administration.module";
import { ApplicationModule } from "@modules/device-management/application.module";
import { IoTDeviceModule } from "@modules/device-management/iot-device.module";
import { SharedModule } from "@modules/shared.module";
import { ReceiveDataService } from "@services/data-management/receive-data.service";

@Module({
    imports: [
        SharedModule,
        ChirpstackAdministrationModule,
        HttpModule,
        ApplicationModule,
        IoTDeviceModule,
    ],
    exports: [ReceiveDataService],
    controllers: [ReceiveDataController],
    providers: [ReceiveDataService],
})
export class ReceiveDataModule {}
