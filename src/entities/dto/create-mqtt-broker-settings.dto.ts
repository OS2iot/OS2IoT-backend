﻿import { AuthenticationType } from "@enum/authentication-type.enum";
import { ApiProperty } from "@nestjs/swagger";
import { IsEnum, IsString, ValidateIf } from "class-validator";

export class CreateMqttBrokerSettingsDto {
    @ApiProperty({ required: true })
    @IsEnum(AuthenticationType)
    authenticationType: AuthenticationType;

    @ValidateIf(d => d.authenticationType === AuthenticationType.PASSWORD)
    @ApiProperty({ required: true })
    @IsString()
    mqttusername: string;

    @ValidateIf(d => d.authenticationType === AuthenticationType.PASSWORD)
    @ApiProperty({ required: true })
    @IsString()
    mqttpassword: string;
}