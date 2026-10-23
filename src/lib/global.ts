

export interface GlobalData {
  plantid: string | null;
  sessionid: string | null;
  customsessionid: string | null;
  mccid: string | null;
  mccname: string | null;
  mccLoginId: string | null;
  centerdata: unknown[] | null;
  id: string | null;
  userid: string | null;
  stationid: string | null;
}

export const GLOBALS: GlobalData = {
  plantid: null,
  sessionid: null,
  customsessionid: null,
  mccid: null,
  mccname: null,
  mccLoginId: null,
  centerdata: null,
  id: null,
  userid: null,
  stationid: null,
};

export const GLOBALPAGESIZE = {
  defaultPageSize: [{ size: 100 }],
};

const MILK_OPTIONS = [
  { Id: 'C', Name: 'Cow' },
  { Id: 'B', Name: 'Buffalo' },
  { Id: 'M', Name: 'Mix Milk' },
  { Id: 'Z', Name: 'Both' },
] as const;

const SHIFT_OPTIONS = [
  { Id: 'M', Name: 'Morning' },
  { Id: 'E', Name: 'Evening' },
  { Id: 'Z', Name: 'Both' },
] as const;

export const GLOBALSMILK = { milkOptions: MILK_OPTIONS };
export const GLOBALSSHIFT = { shiftOptions: SHIFT_OPTIONS };

export const DEFAULT_MILK = MILK_OPTIONS[0].Id;
export const DEFAULT_SHIFT = SHIFT_OPTIONS[0].Id;

export const milkName = (id: string): string => MILK_OPTIONS.find((m) => m.Id === id)?.Name ?? id;
export const shiftName = (id: string): string => SHIFT_OPTIONS.find((s) => s.Id === id)?.Name ?? id;

export const SHIFT_MORNING = shiftName('M');
export const SHIFT_EVENING = shiftName('E');
export const MILK_COW = milkName('C');
export const MILK_BUFFALO = milkName('B');
export const MILK_MIX = milkName('M');

export const GLOBALLABELS = {
  plantMcc: 'Plant/MCC Name',
  centre: 'Centre',
  centres: 'Centres',
  vlcName: 'VLC Name',
  farmerName: 'Farmer Name',
  milkType: 'Milk Type',
  shift: 'Shift',
  fromDate: 'From Date',
  toDate: 'To Date',
  allFarmers: 'All farmers',
  allCentres: 'All',
} as const;

export const DEFAULT_PAGE_SIZE: number = GLOBALPAGESIZE.defaultPageSize[0].size;

export const limitLength = (value: string, max: number) => (value.length > max ? value.slice(0, max) : value);

export class Pagination<T = unknown> {
  data: T[];
  pageSize: number;
  currentPage: number;
  paginatedData: T[];

  constructor(data: T[], pageSize: number = DEFAULT_PAGE_SIZE) {
    this.data = data;
    this.pageSize = pageSize;
    this.currentPage = 1;
    this.paginatedData = [];
    this.setPage(1);
  }

  setPage(page: number) {
    if (page < 1) return;
    if (page > this.totalPages) return;
    this.currentPage = page;
    const startIndex = (page - 1) * this.pageSize;
    this.paginatedData = this.data.slice(startIndex, startIndex + this.pageSize);
  }

  setPageSize(size: number) {
    this.pageSize = size;
    this.setPage(1);
  }

  get totalPages(): number {
    return Math.ceil(this.data.length / this.pageSize);
  }

  get startIndex(): number {
    return (this.currentPage - 1) * this.pageSize + 1;
  }

  get endIndex(): number {
    return Math.min(this.startIndex + this.pageSize - 1, this.data.length);
  }

  get totalItems(): number {
    return this.data.length;
  }

  get pageNumbers(): number[] {
    const totalPages = this.totalPages;
    const currentPage = this.currentPage;
    let startPage: number, endPage: number;
    if (totalPages <= 3) {
      startPage = 1;
      endPage = totalPages;
    } else if (currentPage <= 2) {
      startPage = 1;
      endPage = 3;
    } else if (currentPage + 1 >= totalPages) {
      startPage = totalPages - 2;
      endPage = totalPages;
    } else {
      startPage = currentPage - 1;
      endPage = currentPage + 1;
    }
    return Array.from(Array(endPage + 1 - startPage).keys()).map((i) => startPage + i);
  }
}
