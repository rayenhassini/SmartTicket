import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TypeSupport } from './entities/type-support.entity';
import { TypeSupportsService } from './type-supports.service';
import { TypeSupportsController } from './type-supports.controller';

@Module({
  imports: [TypeOrmModule.forFeature([TypeSupport])],
  controllers: [TypeSupportsController],
  providers: [TypeSupportsService],
  exports: [TypeSupportsService],
})
export class TypeSupportsModule {}
