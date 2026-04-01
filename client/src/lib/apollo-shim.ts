// Shim for @apollo/client — only needed because @jobber/hooks lists it
// as an optional peer dep. We don't use Apollo so export empty stubs.
export const useQuery = () => ({ data: undefined, loading: false, error: undefined });
export const useMutation = () => [() => {}, { data: undefined, loading: false, error: undefined }];
export const useApolloClient = () => null;
export const gql = (strings: TemplateStringsArray, ...values: unknown[]) =>
  strings.reduce((acc, str, i) => acc + str + (values[i] ?? ""), "");
export const ApolloClient = class {};
export const InMemoryCache = class {};
export const ApolloProvider = ({ children }: { children: unknown }) => children;
export default {};
