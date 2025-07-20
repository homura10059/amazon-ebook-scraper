type Result<T, E> = { success: true; data: T } | { success: false; error: E };

export type AmazonURL = string & { readonly _brand: "AmazonURL" };
export type ProductTitle = string & { readonly _brand: "ProductTitle" };
export type ProductPrice = string & { readonly _brand: "ProductPrice" };
export type Timestamp = number & { readonly _brand: "Timestamp" };

export interface ProductData {
  readonly title: ProductTitle;
  readonly price: ProductPrice;
  readonly timestamp: Timestamp;
}

export const createAmazonURL = (url: string): Result<AmazonURL, string> => {
  if (!url.includes("amazon.co.jp")) {
    return { success: false, error: "URL must be from amazon.co.jp domain" };
  }
  return { success: true, data: url as AmazonURL };
};

export const createProductTitle = (
  title: string
): Result<ProductTitle, string> => {
  const cleanTitle = title.replace(/\s+/g, " ").trim();
  if (cleanTitle.length === 0) {
    return { success: false, error: "Product title cannot be empty" };
  }
  return { success: true, data: cleanTitle as ProductTitle };
};

export const createProductPrice = (
  price: string
): Result<ProductPrice, string> => {
  const cleanPrice = price.trim();
  if (cleanPrice.length === 0) {
    return { success: false, error: "Product price cannot be empty" };
  }
  if (
    !(
      cleanPrice.includes("￥") ||
      cleanPrice.includes("¥") ||
      /\d/.test(cleanPrice)
    )
  ) {
    return { success: false, error: "Invalid price format" };
  }
  return { success: true, data: cleanPrice as ProductPrice };
};

export const createTimestamp = (): Timestamp =>
  Math.floor(Date.now() / 1000) as Timestamp;

export const createProductData = (
  title: string,
  price: string
): Result<ProductData, string> => {
  const titleResult = createProductTitle(title);
  if (!titleResult.success) return titleResult;

  const priceResult = createProductPrice(price);
  if (!priceResult.success) return priceResult;

  return {
    success: true,
    data: {
      title: titleResult.data,
      price: priceResult.data,
      timestamp: createTimestamp(),
    },
  };
};
