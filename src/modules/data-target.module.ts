import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { HttpPushDataTarget } from "@entities/http-push-data-target.entity";
import { DataTargetController } from "@admin-controller/data-target.controller";
import { DataTargetService } from "@services/data-target.service";
import { DataTarget } from "@entities/data-target.entity";
import { Application } from "@entities/application.entity";
import { ApplicationService } from "@services/application.service";
import { IoTDevice } from "@entities/iot-device.entity";
import { GenericHTTPDevice } from "@entities/generic-http-device.entity";

@Module({
    imports: [
        TypeOrmModule.forFeature([
            HttpPushDataTarget,
            DataTarget,
            Application,
            GenericHTTPDevice,
            IoTDevice,
        ]),
    ],
    exports: [TypeOrmModule],
    controllers: [DataTargetController],
    providers: [DataTargetService, ApplicationService],
})
export class DataTargetModule {}