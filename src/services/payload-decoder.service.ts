import { Injectable, Logger, BadRequestException } from "@nestjs/common";
import { PayloadDecoder } from "@entities/payload-decoder.entity";
import { Repository, DeleteResult, In } from "typeorm";
import { InjectRepository } from "@nestjs/typeorm";
import { CreatePayloadDecoderDto } from "@dto/create-payload-decoder.dto";
import { UpdatePayloadDecoderDto } from "@dto/update-payload-decoder.dto";
import { ListAllEntitiesDto } from "@dto/list-all-entities.dto";
import { ListAllPayloadDecoderReponseDto } from "@dto/list-all-payload-decoders-response.dto";
import { ErrorCodes } from "@entities/enum/error-codes.enum";
import { OrganizationService } from "./user-management/organization.service";

@Injectable()
export class PayloadDecoderService {
    constructor(
        @InjectRepository(PayloadDecoder)
        private payloadDecoderRepository: Repository<PayloadDecoder>,
        private organizationService: OrganizationService
    ) {}

    async findOne(id: number): Promise<PayloadDecoder> {
        return await this.payloadDecoderRepository.findOneOrFail(id, {
            relations: ["organization"],
        });
    }

    async findAndCountWithPagination(
        query: ListAllEntitiesDto,
        organizationIds?: number[]
    ): Promise<ListAllPayloadDecoderReponseDto> {
        const [
            result,
            total,
        ] = await this.payloadDecoderRepository.findAndCount({
            where: organizationIds != null ? { organization: In(organizationIds) } : {},
            take: query.limit,
            skip: query.offset,
            order: { id: query.sort }, // TODO: Generic sorting possible?
            relations: ["organization"],
        });

        return {
            data: result,
            count: total,
        };
    }

    async create(createDto: CreatePayloadDecoderDto): Promise<PayloadDecoder> {
        const newPayloadDecoder = new PayloadDecoder();
        const mappedPayloadDecoder = await this.mapDtoToPayloadDecoder(
            createDto,
            newPayloadDecoder
        );

        return await this.payloadDecoderRepository.save(mappedPayloadDecoder);
    }

    async update(
        id: number,
        updateDto: UpdatePayloadDecoderDto
    ): Promise<PayloadDecoder> {
        const payloadDecoder = await this.payloadDecoderRepository.findOneOrFail(
            id
        );

        const mappedPayloadDecoder = await this.mapDtoToPayloadDecoder(
            updateDto,
            payloadDecoder
        );

        return await this.payloadDecoderRepository.save(mappedPayloadDecoder);
    }

    async delete(id: number): Promise<DeleteResult> {
        return await this.payloadDecoderRepository.delete(id);
    }

    private async mapDtoToPayloadDecoder(
        createDto: CreatePayloadDecoderDto,
        newPayloadDecoder: PayloadDecoder
    ) {
        newPayloadDecoder.name = createDto.name;
        try {
            newPayloadDecoder.decodingFunction = JSON.parse(
                createDto.decodingFunction
            );
        } catch (err) {
            Logger.error("Failed to parse decodingFunction", err);
            throw new BadRequestException(ErrorCodes.BadEncoding);
        }
        try {
            newPayloadDecoder.organization = await this.organizationService.findById(
                createDto.organizationId
            );
        } catch (err) {
            Logger.error(
                `Could not find Organization with id ${createDto.organizationId}`
            );
            throw new BadRequestException(ErrorCodes.OrganizationDoesNotExists);
        }

        return newPayloadDecoder;
    }
}
