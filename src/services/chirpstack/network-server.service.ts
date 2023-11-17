import { Injectable, InternalServerErrorException, OnModuleInit } from "@nestjs/common";
import { AxiosResponse } from "axios";

import { CreateNetworkServerDto } from "@dto/chirpstack/create-network-server.dto";
import { ListAllNetworkServerResponseDto } from "@dto/chirpstack/list-all-network-server-response.dto";
import { NetworkServerDto } from "@dto/chirpstack/network-server.dto";

import { GenericChirpstackConfigurationService } from "@services/chirpstack/generic-chirpstack-configuration.service";
import { ListAllAdrAlgorithmsResponseDto } from "@dto/chirpstack/list-all-adr-algorithms-response.dto";

@Injectable()
export class ChirpstackSetupNetworkServerService extends GenericChirpstackConfigurationService {
    networkServerName = "OS2iot";

    public async bootstrapChirpstackNetworkServerConfiguration(): Promise<void> {
        const networkServers = await this.getNetworkServers(100, 0);
        const alreadyCreated = networkServers.result.some(networkServer => {
            return (
                networkServer.name.toLocaleLowerCase() ==
                this.networkServerName.toLocaleLowerCase()
            );
        });

        if (!alreadyCreated) {
            try {
                await this.postNetworkServer(this.setupNetworkServerData());
            } catch (error) {
                throw new InternalServerErrorException(error?.result?.data);
            }
        }
    }

    public async postNetworkServer(data: CreateNetworkServerDto): Promise<AxiosResponse> {
        return await this.post("network-servers", data);
    }

    public async putNetworkServer(
        data: CreateNetworkServerDto,
        id: number
    ): Promise<AxiosResponse> {
        return await this.put("network-servers", data, id.toString());
    }
    public async deleteNetworkServer(id: number): Promise<AxiosResponse> {
        return await this.delete("network-servers", id.toString());
    }

    public async getNetworkServerCount(): Promise<number> {
        const result: ListAllNetworkServerResponseDto = await this.getNetworkServers(
            1000,
            0
        );
        return result.totalCount;
    }

    public setupNetworkServerData(): CreateNetworkServerDto {
        const networkServerDto: NetworkServerDto = {
            name: this.networkServerName,
            server: this.networkServer,
        };
        const createNetworkServerDto: CreateNetworkServerDto = {
            networkServer: networkServerDto,
        };

        return createNetworkServerDto;
    }

    public async getAdrAlgorithmsForDefaultNetworkServer(): Promise<ListAllAdrAlgorithmsResponseDto> {
        const networkServerId = await this.getDefaultNetworkServerId();
        return await this.get(`network-servers/${networkServerId}/adr-algorithms`);
    }
}
