import { ApiProperty } from '@nestjs/swagger';
import { IsEmpty, IsNotEmpty, IsOptional, MinLength } from 'class-validator';

export class CreateUserDto {
  @IsNotEmpty()
  @ApiProperty()
  name: string;

  @IsEmpty() //this filed not needed
  @IsOptional()
  @ApiProperty()
  first_name?: string;

  @IsEmpty() //this filed not needed
  @IsOptional()
  @ApiProperty()
  last_name?: string;

  @IsNotEmpty()
  @ApiProperty()
  email: string;

  @IsNotEmpty()
  @MinLength(8, { message: 'Password should be minimum 8' })
  @ApiProperty()
  password: string;

  @ApiProperty({
    type: String,
    example: 'user',
  })
  type?: string;
}
