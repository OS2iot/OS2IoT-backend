import { Injectable, Logger, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcryptjs";
import * as xml2js from "xml2js";
import { UserResponseDto } from "@dto/user-response.dto";
import { JwtPayloadDto } from "@entities/dto/internal/jwt-payload.dto";
import { ErrorCodes } from "@entities/enum/error-codes.enum";
import { UserService } from "./user.service";
import { Profile } from "passport-saml";
import { JwtResponseDto } from "@dto/jwt-response.dto";
import { XMLOutput } from "@dto/user-management/xml-object";
import configuration from "@config/configuration";

@Injectable()
export class AuthService {
    constructor(private usersService: UserService, private jwtService: JwtService) {
        this.KOMBIT_ROLE_URI = configuration()["kombit"]["roleUri"];
    }
    private readonly logger = new Logger(AuthService.name);
    private readonly KOMBIT_ROLE_URI: string;

    async validateUser(username: string, password: string): Promise<UserResponseDto> {
        const user = await this.usersService.findOneUserByEmailWithPassword(username);
        if (user) {
            if (!user.active) {
                throw new UnauthorizedException(ErrorCodes.UserInactive);
            }

            const res = await bcrypt.compare(password, user.passwordHash);
            if (res === true) {
                await this.usersService.updateLastLoginToNow(user);
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                const { passwordHash, ...result } = user;
                return result;
            } else {
                this.logger.warn(`Login with user: '${username}' used wrong password`);
            }
        } else {
            this.logger.warn(`Login with non-existing user: '${username}'`);
        }
        return null;
    }

    private async getPrivilegesIntermediate(profile: Profile): Promise<string> {
        const xml = profile.getAssertionXml();
        const parser = this.getXmlParser();

        return await parser
            .parseStringPromise(xml)
            .then((doc: XMLOutput) => {
                const assertion = doc["Assertion"];
                const privilegesNode = assertion["AttributeStatement"][0][
                    "Attribute"
                ].find((x: XMLOutput) => {
                    return (
                        x["$"]["Name"] == "dk:gov:saml:attribute:Privileges_intermediate"
                    );
                });
                const base64Xml = privilegesNode["AttributeValue"][0]["_"];

                return base64Xml;
            })
            .catch((err: any) => {
                this.logger.error("Could not load attribute in SAML response");
                return null;
            });
    }

    private async isAllowed(privilegesBase64: string): Promise<boolean> {
        const decodedXml = Buffer.from(privilegesBase64, "base64").toString("binary");

        const parser = this.getXmlParser();

        return await parser
            .parseStringPromise(decodedXml)
            .then((doc: XMLOutput) => {
                return doc["PrivilegeList"][
                    "PrivilegeGroup"
                ].some((privilegeGroups: XMLOutput) =>
                    privilegeGroups["Privilege"].some(
                        (privileges: XMLOutput) =>
                            privileges["_"].indexOf(this.KOMBIT_ROLE_URI) > -1
                    )
                );
            })
            .catch((err: any) => {
                this.logger.error("Could not find privileges in result");
                return false;
            });
    }

    private getXmlParser() {
        const parserConfig = {
            explicitRoot: true,
            explicitCharkey: true,
            tagNameProcessors: [xml2js.processors.stripPrefix],
        };
        const parser = new xml2js.Parser(parserConfig);
        return parser;
    }

    async validateKombitUser(profile: Profile): Promise<UserResponseDto> {
        const privilegesBase64 = await this.getPrivilegesIntermediate(profile);
        if (!privilegesBase64 || !this.isAllowed(privilegesBase64)) {
            // User doesn't have brugersystemrolle ...
            throw new UnauthorizedException(ErrorCodes.MissingRole);
        }
        // TODO: Check if they have attribute to allow them into OS2IOT
        let user = await this.usersService.findOneByNameId(profile.nameID);
        if (user) {
            this.logger.debug(
                `User from Kombit ('${profile.nameID}') already exists with id: ${user.id}`
            );
            if (!user.active) {
                this.logger.debug(`User (${user.id}) is disabled, not allowed!`);
                throw new UnauthorizedException(ErrorCodes.UserInactive);
            }
        } else {
            this.logger.debug(
                `User from Kombit ('${profile.nameID}') does not already exist, will create.`
            );

            user = await this.usersService.createUserFromKombit(profile);
        }

        await this.usersService.updateLastLoginToNow(user);

        return user;
    }

    async issueJwt(
        email: string,
        id: number,
        isKombit?: boolean
    ): Promise<JwtResponseDto> {
        const payload: JwtPayloadDto = { username: email, sub: id, isKombit: isKombit };
        return {
            accessToken: this.jwtService.sign(payload),
        };
    }
}
