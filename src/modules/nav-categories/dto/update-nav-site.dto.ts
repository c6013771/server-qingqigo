import { PartialType } from '@nestjs/swagger';
import { CreateNavSiteDto } from './create-nav-site.dto';

export class UpdateNavSiteDto extends PartialType(CreateNavSiteDto) {}
