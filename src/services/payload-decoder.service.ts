import { Injectable } from "@nestjs/common";
import { PayloadDecoder } from "@entities/payload-decoder.entity";
import { Repository, DeleteResult } from "typeorm";
import { InjectRepository } from "@nestjs/typeorm";
import { CreatePayloadDecoderDto } from "@dto/create-payload-decoder.dto";
import { UpdatePayloadDecoderDto } from "@dto/update-payload-decoder.dto";

@Injectable()
export class PayloadDecoderService {
    constructor(
        @InjectRepository(PayloadDecoder)
        private payloadDecoderRepository: Repository<PayloadDecoder>
    ) {}

    async findOne(id: number): Promise<PayloadDecoder> {
        return await this.payloadDecoderRepository.findOneOrFail(id);
    }

    async create(createDto: CreatePayloadDecoderDto): Promise<PayloadDecoder> {
        const newPayloadDecoder = new PayloadDecoder();
        const mappedPayloadDecoder = this.mapDtoToPayloadDecoder(
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

        const mappedPayloadDecoder = this.mapDtoToPayloadDecoder(
            updateDto,
            payloadDecoder
        );

        return await this.payloadDecoderRepository.save(mappedPayloadDecoder);
    }

    async delete(id: number): Promise<DeleteResult> {
        return await this.payloadDecoderRepository.delete(id);
    }

    private mapDtoToPayloadDecoder(
        createDto: CreatePayloadDecoderDto,
        newPayloadDecoder: PayloadDecoder
    ) {
        newPayloadDecoder.name = createDto.name;
        newPayloadDecoder.decodingFunction = JSON.parse(
            createDto.decodingFunction
        );

        return newPayloadDecoder;
    }
}
