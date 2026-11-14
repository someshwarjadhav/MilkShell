
export const DPU_HOST = 'https://dpu.shivinfotech.co.in';

export const DPU = {
  // rate
  getRate: '/Login/getRate',
  getRateStatus: '/Login/GetRateStatus',
  showRateWeb: '/Login/ShowRateWeb',
  dpuSyncAsync: '/Login/dpuSyncAsync',
  // collection
  vlcMilkCollection: '/Login/VlcMilkCollection',
  milkCollectionVlc: '/Login/MilkCollectionvlc',
  milkCollection: '/Login/MilkCollection',
  farmerCollection: '/Login/FarmerCollection',
  updateMilkEntry: '/Login/updateMilkEntry',
  farmerCollectionDelete: '/Login/FarmerCollectionDelete',
  // standard deduction
  farmerMasterCN: '/Login/FarmerMasterCN',
  farmerMasterCNEntry: '/Login/FarmerMasterCNEntry',
  farmerMasterVlccDed: '/Login/FarmerMasterVlccDed',
  villageMasterCNEntry: '/Login/VillageMasterCNEntry',
  // deduction entry
  billDeductionDetailsMA: '/Login/billDeductionDetailsMA',
  getBillHead: '/Login/getBillHead',
  addBillDeduction: '/Login/addBillDeduction',
  // farmer bill
  milkBillProcessMA: '/Login/MilkBillProcessMA',
  getMilkBillFreeze: '/Login/GetMilkBillFreeze',
  milkBillPaySummMA: '/Login/MilkBillPaySummMA',
} as const;
