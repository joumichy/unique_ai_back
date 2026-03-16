export interface ValidatedGetDauMetricsQueryDto {
  fromDay: Date;
  toDay: Date;
  companyId?: string;
  feature?: string;
}
