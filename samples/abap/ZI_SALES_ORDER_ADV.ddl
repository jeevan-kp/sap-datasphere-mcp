@AbapCatalog.sqlViewName: 'ZISALESORDERADV'
@AbapCatalog.compiler.compareFilter: true
@AbapCatalog.preserveKey: true
@AccessControl.authorizationCheck: #CHECK
@EndUserText.label: 'Advanced Sales Order View with Associations'

define view ZI_SALES_ORDER_ADV
  as select from vbak
  association [1] to kna1 as _Customer on $projection.kunnr = _Customer.kunnr
  association [1] to mara as _Material on $projection.matnr = _Material.matnr
  association [*] to vbap as _Items on $projection.vbeln = _Items.vbeln
  association [1] to tvko as _SalesOrg on $projection.vkorg = _SalesOrg.vkorg
  association [1] to tvst as _Status on $projection.gbstk = _Status.estat
{
      @EndUserText.label: 'Sales Order Number'
  key vbak.vbeln as SalesOrderNumber,
      @EndUserText.label: 'Created On'
      vbak.erdat as CreationDate,
      @EndUserText.label: 'Customer Number'
      vbak.kunnr as CustomerNumber,
      _Customer.name1 as CustomerName,
      vbak.vkorg as SalesOrganization,
      vbak.vtweg as DistributionChannel,
      vbak.spart as Division,
      vbak.auart as OrderType,
      vbak.netwr as NetValue,
      vbak.waerk as Currency,
      vbak.erzer as CreationTime,
      vbak.aedat as LastChangeDate,
      vbak.gbstk as OverallStatus,
      _Status.bezei as StatusDescription,
      case
        when vbak.netwr > 100000 then 'HIGH'
        when vbak.netwr > 10000 then 'MEDIUM'
        else 'LOW'
      end as OrderSizeCategory,
      @Semantics.quantity.unitOfMeasure: 'Unit'
      _Items.kwmeng as TotalQuantity,
      _Items.meins as Unit,
      // Associations
      _Customer,
      _Material,
      _Items,
      _SalesOrg,
      _Status
}
where
  vbak.vbtyp = 'C'  // Standard Order
  and vbak.gbstk <> 'C'  // Not completely processed