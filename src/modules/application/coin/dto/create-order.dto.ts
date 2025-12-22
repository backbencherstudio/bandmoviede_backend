import { IsNotEmpty, IsNumber, IsOptional, IsString } from "class-validator";

export class CreateOrderDto {
    @IsString()
    @IsNotEmpty()
    bundle_id: string;

    @IsString()
    @IsNotEmpty()
    sugo_id: string;

    @IsNumber()
    @IsOptional()
    quantity?: number;
}
