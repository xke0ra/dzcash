import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { OffersService } from './offers.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('offers')
@UseGuards(JwtAuthGuard)
export class OffersController {
  constructor(private offersService: OffersService) {}

  @Get()
  async getOffers(@Query('category') categorySlug?: string) {
    return this.offersService.getOffers(categorySlug);
  }

  @Get('categories')
  async getCategories() {
    return this.offersService.getCategories();
  }

  @Get(':id')
  async getOfferById(@Param('id') id: string) {
    return this.offersService.getOfferById(id);
  }
}
