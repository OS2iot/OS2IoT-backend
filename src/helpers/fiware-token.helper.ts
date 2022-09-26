import { CACHE_MANAGER, HttpService, Inject, Injectable, Logger } from "@nestjs/common"
import { Cache } from 'cache-manager'
import { FiwareDataTargetConfiguration } from "../entities/interfaces/fiware-data-target-configuration.interface";

type TokenEndpointResponse = {
    data: {
        access_token: string,
        expires_in: number,
    }
}

@Injectable()
export class AuthenticationTokenProvider {

    private readonly logger = new Logger(AuthenticationTokenProvider.name);

    constructor(private httpService: HttpService, @Inject(CACHE_MANAGER) private cacheManager: Cache) {
    }

    async clearConfig(config: FiwareDataTargetConfiguration): Promise<void> {
        if (config.clientId || config.clientSecret) {
            this.logger.debug(`AuthenticationTokenProvider clearing token for ${config.clientId}`)
            const key = config.clientId + config.clientSecret
            return this.cacheManager.del(key)
        }
    }

    async getToken(config: FiwareDataTargetConfiguration): Promise<string> {
        const key = config.clientId + config.clientSecret;

        const token = await this.cacheManager.get<string>(key)
        if (token) {
            return token
        } else {
            try {
                const params = new URLSearchParams([
                    ['grant_type', 'client_credentials'],
                    ['client_id', config.clientId],
                    ['client_secret', config.clientSecret]
                ])
                const { data }: TokenEndpointResponse = await this.httpService.post(config.tokenEndpoint, params, {
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                    },
                }).toPromise()

                // NOTE: TTL offset include some time for clock differences between authentication server and local server + network delay
                const ttlOffset = 30
                const ttl = data.expires_in - ttlOffset
                this.logger.debug(`AuthenticationTokenProvider caching token for ${config.clientId} (expires in ${ttl} seconds)`)
                await this.cacheManager.set(key, data.access_token, { ttl })
                return data.access_token
            }
            catch (err) {
                this.logger.error(`AuthenticationTokenProvider got error ${err}`)
                throw err
            }
        }
    }
}