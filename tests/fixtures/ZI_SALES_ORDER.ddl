"""Sample CDS View for testing"""
@AccessControl.authorizationCheck: #CHECK
@EndUserText.label: 'Sales Order View'
define view ZI_SALES_ORDER as select from vbak
  left outer join vbap on vbak.vbeln = vbap.vbeln
  left outer join mara on vbap.matnr = mara.matnr
{
  @EndUserText.label: 'Sales Order Number'
  @UI.lineItem: [{ position: 10 }]
  key vbak.vbeln as SalesOrder,

  @EndUserText.label: 'Creation Date'
  @UI.lineItem: [{ position: 20 }]
  vbak.erdat as CreationDate,

  @EndUserText.label: 'Material Number'
  @UI.lineItem: [{ position: 30 }]
  vbap.matnr as Material,

  @EndUserText.label: 'Material Description'
  @UI.lineItem: [{ position: 40 }]
  mara.maktx as MaterialDescription,

  @EndUserText.label: 'Order Quantity'
  @UI.lineItem: [{ position: 50 }]
  vbap.kwmeng as Quantity,

  @EndUserText.label: 'Net Value'
  @UI.lineItem: [{ position: 60 }]
  vbap.netwr as NetValue,

  @EndUserText.label: 'Document Currency'
  vbak.waers as Currency
}
where
  vbak.vbtyp = 'C'
  and vbak.gbstk = 'C'
