import { Injectable, Logger, HttpService } from "@nestjs/common";
import { JwtToken } from "./jwt-token";
import { AuthorizationType } from "@enum/authorization-type.enum";
import { AxiosRequestConfig } from "axios";

@Injectable()
export abstract class GenericChirpstackConfigurationService {
    constructor(private httpService: HttpService) {}

    private readonly baseUrl = "http://localhost:8080/api/";

    setupHeader(endPoint: string, limit?: number, offset?: number): any {
        if (limit != null && offset != null) {
            return {
                url:
                    this.baseUrl +
                    endPoint +
                    "?limit=" +
                    limit +
                    "&" +
                    offset +
                    "=0",
                timeout: 3000,
                authorizationType: AuthorizationType.HEADER_BASED_AUTHORIZATION,
                authorizationHeader: "Bearer " + JwtToken.setupToken(),
            };
        }
        return {
            url: this.baseUrl + endPoint,
            timeout: 3000,
            authorizationType: AuthorizationType.HEADER_BASED_AUTHORIZATION,
            authorizationHeader: "Bearer " + JwtToken.setupToken(),
        };
    }
    setupData(rawBody: string): any {
        return {
            rawBody: rawBody,
            mimeType: "application/json",
        };
    }

    makeAxiosConfiguration(config: any): AxiosRequestConfig {
        const axiosConfig: AxiosRequestConfig = {
            timeout: config.timeout,
            headers: { "Content-Type": "application/json" },
        };

        axiosConfig.headers["Authorization"] = config.authorizationHeader;

        return axiosConfig;
    }

    async post(endpoint: string, data: string): Promise<JSON> {
        const header = this.setupHeader(endpoint);
        const axiosConfig = this.makeAxiosConfiguration(header);

        try {
            const result = await this.httpService
                .post(header.url, data, axiosConfig)
                .toPromise();

            Logger.warn(
                `post: ${data} to  ${endpoint} resulting in ${result.status.toString()} and message: ${
                    result.statusText
                }`
            );
            return result.data; //TODO: set return;
        } catch (err) {
            Logger.error(`post got error: ${err}`);
            return null; //TODO: set return;
        }
    }

    async put(endpoint: string, data: string, id: number): Promise<JSON> {
        const header = this.setupHeader(endpoint);
        const axiosConfig = this.makeAxiosConfiguration(header);
        const url = header.url + "/" + id;

        try {
            const result = await this.httpService
                .put(url, data, axiosConfig)
                .toPromise();

            Logger.warn(
                `put: ${data} to  ${endpoint} resulting in ${result.status.toString()} and message: ${
                    result.statusText
                }`
            );
            return result.data; //TODO: set return;
        } catch (err) {
            Logger.error(`Put got error: ${err}`);
        }
    }

    async get(
        endpoint: string,
        limit?: number,
        offset?: number
    ): Promise<JSON> {
        const header = this.setupHeader(endpoint, limit, offset);
        const axiosConfig = this.makeAxiosConfiguration(header);

        try {
            const result = await this.httpService
                .get(header.url, axiosConfig)
                .toPromise();

            Logger.warn(
                `get all from:${endpoint} resulting in ${result.status.toString()} and message: ${
                    result.statusText
                }`
            );
            return result.data;
        } catch (err) {
            Logger.error(`get got error: ${err}`);
        }
    }

    async getCount(endpoint: string): Promise<number> {
        const header = this.setupHeader(endpoint);
        const axiosConfig = this.makeAxiosConfiguration(header);
        try {
            const result = await this.httpService
                .get(header.url, axiosConfig)
                .toPromise();

            Logger.warn(
                `getCount: ${
                    result.data.totalCount
                } from ${endpoint} resulting in ${result.status.toString()} and message: ${
                    result.statusText
                }`
            );
            return result.data.totalCount;
        } catch (err) {
            Logger.error(`getCount got error: ${err}`);
        }
    }

    async delete(endpoint: string, id: number): Promise<JSON> {
        const header = this.setupHeader(endpoint);
        const axiosConfig = this.makeAxiosConfiguration(header);
        const url = header.url + "/" + id;
        try {
            const result = await this.httpService
                .delete(url, axiosConfig)
                .toPromise();

            Logger.warn(
                `delete : ${result.status.toString()} and message: ${
                    result.statusText
                }`
            );
            return result.data;
        } catch (err) {
            Logger.error(`Delete got error: ${err}`);
        }
    }
}
