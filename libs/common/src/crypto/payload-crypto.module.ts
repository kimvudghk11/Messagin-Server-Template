import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PayloadCryptoService } from './payload-crypto.service';

@Module({
  imports: [ConfigModule],
  providers: [PayloadCryptoService],
  exports: [PayloadCryptoService],
})
export class PayloadCryptoModule {}
