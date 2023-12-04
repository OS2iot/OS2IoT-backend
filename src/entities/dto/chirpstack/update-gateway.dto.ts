import { ApiHideProperty, ApiProperty, OmitType } from "@nestjs/swagger";
import { ValidateNested } from "class-validator";
import { GatewayContentsDto } from "./gateway-contents.dto";
import { Type } from "class-transformer";

export class UpdateGatewayContentsDto extends OmitType(GatewayContentsDto, ["gatewayId"]) {
    @ApiHideProperty()
    gatewayId: string;
}

export class UpdateGatewayDto {
    @ApiProperty({ required: true })
    @ValidateNested({ each: true })
    @Type(() => UpdateGatewayContentsDto)
    gateway: UpdateGatewayContentsDto;
}
