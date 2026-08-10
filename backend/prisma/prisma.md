#create migration:

bunx --bun prisma migrate dev --name user_creation

#Generate the Prisma Client:

bunx --bun prisma generate

#Prisma Studio :

bunx --bun prisma studio