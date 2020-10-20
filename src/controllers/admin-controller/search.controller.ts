import { JwtAuthGuard } from "@auth/jwt-auth.guard";
import { Read } from "@auth/roles.decorator";
import { RolesGuard } from "@auth/roles.guard";
import { AuthenticatedRequest } from "@dto/internal/authenticated-request";
import { ListAllSearchResultsResponseDto } from "@dto/list-all-search-results-response.dto";
import { SearchResultType } from "@dto/search-result.dto";
import { ErrorCodes } from "@enum/error-codes.enum";
import {
    BadRequestException,
    Controller,
    Get,
    Logger,
    Query,
    Req,
    UseGuards,
} from "@nestjs/common";
import {
    ApiTags,
    ApiBearerAuth,
    ApiForbiddenResponse,
    ApiUnauthorizedResponse,
    ApiOperation,
} from "@nestjs/swagger";
import { SearchService } from "@services/data-management/search.service";
import { isNumber } from "lodash";

@Controller("search")
@ApiTags("Search")
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
@Read()
@ApiForbiddenResponse()
@ApiUnauthorizedResponse()
export class SearchController {
    constructor(private service: SearchService) {}

    private readonly logger = new Logger(SearchController.name);

    @Get()
    @ApiOperation({
        summary:
            "Search for " +
            Object.values(SearchResultType)
                .filter(x => !isNumber(x))
                .join(", "),
    })
    async search(
        @Req() req: AuthenticatedRequest,
        @Query("q") query?: string
    ): Promise<ListAllSearchResultsResponseDto> {
        if (query == null || query.trim() === "") {
            throw new BadRequestException(ErrorCodes.QueryMustNotBeEmpty);
        }
        console.time("search");
        const res = await this.service.findByQuery(req, query);
        console.timeEnd("search");
        return res;
    }
}