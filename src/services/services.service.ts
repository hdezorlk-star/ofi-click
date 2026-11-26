import { getDataProvider } from './provider';
import type { PortfolioItem, ServiceItem } from '../types/oficlick';

export const servicesService = {
  saveService: (service: ServiceItem) => getDataProvider().saveService(service),
  deleteService: (serviceId: string) => getDataProvider().deleteService(serviceId),
  addPortfolioItem: (item: PortfolioItem) => getDataProvider().addPortfolioItem(item),
  updatePortfolioItem: (item: PortfolioItem) => getDataProvider().updatePortfolioItem(item),
  deletePortfolioItem: (itemId: string) => getDataProvider().deletePortfolioItem(itemId),
};
