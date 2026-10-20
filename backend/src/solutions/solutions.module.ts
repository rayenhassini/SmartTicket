import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Solution } from './entities/solution.entity';
import { SolutionsService } from './solutions.service';
import { SolutionsController } from './solutions.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Solution])],
  controllers: [SolutionsController],
  providers: [SolutionsService],
  exports: [SolutionsService],
})
export class SolutionsModule {}
