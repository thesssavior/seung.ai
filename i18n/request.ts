import {getRequestConfig} from 'next-intl/server';

export default getRequestConfig(async ({requestLocale}) => {
  const locale = (await requestLocale) || 'ko';
  return {
    messages: (await import(`@/messages/${locale}.json`)).default,
    locale,
    timeZone: 'Asia/Seoul'
  };
}); 