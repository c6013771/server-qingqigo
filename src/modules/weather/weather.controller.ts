import { Controller, Get, Headers, Ip, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { WeatherService } from './weather.service';
import { QueryWeatherDto } from './dto/query-weather.dto';

@ApiTags('天气')
@Controller()
export class WeatherController {
  constructor(private weather: WeatherService) {}

  /** GET /api/weather?city=北京 */
  @ApiOperation({ summary: '获取实时天气（和风为主，公用接口兜底，缓存 10 分钟）' })
  @Get('weather')
  getWeather(@Query() query: QueryWeatherDto) {
    return this.weather.getWeather(query.city);
  }

  /** GET /api/location/ip —— 按请求方 IP 定位城市 */
  @ApiOperation({ summary: '根据客户端 IP 定位城市（缓存 24 小时）' })
  @Get('location/ip')
  getCityByIp(@Ip() ip: string, @Headers('x-forwarded-for') forwarded?: string) {
    // 反向代理（Nginx 等）场景下真实客户端 IP 在 X-Forwarded-For 首段
    const clientIp = forwarded?.split(',')[0]?.trim() || ip;
    return this.weather.getCityByIp(clientIp);
  }
}
