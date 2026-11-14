/**
 * The wording of every warning / toast / alert that is shared by several forms.
 * Use these instead of typing the text again so the whole project says the same thing.
 */
export const MSG = {
  /* date filters */
  pickDates: 'Please select the From Date and To Date',
  fromAfterTo: 'From Date cannot be after To Date',
  rangeTooLong: (months = 3): string => `Date range cannot be more than ${months} months. Please select a shorter period`,
  tooOld: (months = 3): string => `Dates older than ${months} months are not available. Please pick a more recent date`,

  /* filters */
  pickCentre: 'Please select a VLC',
  pickFarmer: 'Please select a farmer',
  noCentreInPlant: 'No VLC found for this plant',
  nothingToExport: 'There is nothing to export',

  /* exports */
  exportFailed: 'Export failed. Please try again.',
  popupBlocked: 'Allow pop-ups to open the report',

  /* generic */
  loadFailed: (what: string): string => `The ${what} could not be loaded.`,
  saveFailed: (what: string): string => `The ${what} could not be saved.`,
  saved: (what: string): string => `${what} saved successfully`,
} as const;
