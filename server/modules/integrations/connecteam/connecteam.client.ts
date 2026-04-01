export async function connecteamToken(clientId: string, clientSecret: string): Promise<string> {
  const creds = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const res = await fetch("https://api.connecteam.com/oauth/v1/token", {
    method: "POST",
    headers: {
      "Authorization": `Basic ${creds}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  if (!res.ok) throw new Error("Invalid Connecteam credentials");
  const data: any = await res.json();
  return data.access_token;
}
