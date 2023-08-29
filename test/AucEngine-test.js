const { expect } = require("chai")
const { ethers } = require("hardhat")

describe("AucEngine", function() {
    let owner
    let seller
    let buyer
    let auct

    beforeEach(async function() {
        [owner, seller, buyer] = await ethers.getSigners()

        const AucEngine = await ethers.getContractFactory("AucEngine", owner)
        auct = await AucEngine.deploy()
        await auct.waitForDeployment()
    })

    it("sets owner", async function() {
        const currentOwner = await auct.owner()
        expect(currentOwner).to.eq(await owner.getAddress())
    })

    async function getTimestamp(bn) {
        return (
            await ethers.provider.getBlock(bn)
        ).timestamp
    }

    describe("createAuction", function() {
        it("creates auction correctly", async function() {
            const duration = 60
            const tx = await auct.createAuction(
                ethers.parseEther("0.0001"),
                3,
                "fake item",
                duration
            )

            const cAuction = await auct.auctions(0)
            expect(cAuction.item).to.eq("fake item")

            const ts = await getTimestamp(tx.blockNumber)
            expect(cAuction.endsAt).to.eq(ts + duration)
        })

        it("emits event that auction is created", async function() {
            const itemName = "fake item"
            const startingPrice = ethers.parseEther("0.0001")
            const duration = 60

            const tx = await auct.createAuction(
                startingPrice,
                3,
                itemName,
                duration
            )

            await expect(tx)
                .to.emit(auct, 'AuctionCreated')
                .withArgs(0, itemName, startingPrice, duration);
        })

        it("checks if duration is 0", async function() {
            const duration = 0
            const tx = await auct.createAuction(
                ethers.parseEther("0.0001"),
                3,
                "fake item",
                duration
            )
            const cAuction = await auct.auctions(0)
            const ts = await getTimestamp(tx.blockNumber)
            expect(cAuction.endsAt).to.eq(ts + 172800)
        })

        it("reverts with message incorrect starting price", async function() {
            await expect(
                auct.connect(seller).createAuction(
                    1, 
                    3, 
                    "fake item", 
                    60
                )
            ).to.be.revertedWith('incorrect starting price');
        })
    })

    function delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms))
    }

    describe("buy", function() {
        it("transfers money to seller", async function() {
            await auct.connect(seller).createAuction(
                ethers.parseEther("0.0001"),
                1000000000000,
                "fake item",
                60
            )

            const buyTx = await auct.connect(buyer)
                .buy(0, {value: ethers.parseEther("0.0001")})

            const cAuction = await auct.auctions(0)
            const finalPrice = cAuction.finalPrice

            await expect(() => buyTx)
                .to.changeEtherBalance(
                    seller, 
                    finalPrice - ((finalPrice * 10n) / 100n)
                )
        })

        it("refunds money to buyer", async function() {
            const tx = await auct.connect(seller).createAuction(
                ethers.parseEther("0.0001"),
                1000000000000,
                "fake item",
                60
            )

            this.timeout(5000)
            await delay(1000)

            const buyTx = await auct.connect(buyer)
                .buy(0, {value: ethers.parseEther("0.0001")})

            const cAuction = await auct.auctions(0)
            const finalPrice = cAuction.finalPrice
            const buyerPrice = finalPrice - 1000000000000n

            // await expect(() => buyTx)
            //     .to.changeEtherBalance(
            //         buyer, 
            //         -buyerPrice
            //     )
            console.log(await ethers.provider.getBlock(tx.blockNumber).gasPrice);
        })

        it("reverts with message stopped!", async function() {
            const startingPrice = ethers.parseEther("0.0001")
            await auct.connect(seller).createAuction(
                startingPrice,
                1000000000000,
                "fake item",
                60
            )

            const buyTx = await auct.connect(buyer)
                .buy(0, {value: startingPrice})

            await expect(
                auct.connect(buyer)
                    .buy(0, {value: startingPrice})
            ).to.be.revertedWith('stopped!');
        })

        it("reverts with message ended!", async function() {
            const startingPrice = ethers.parseEther("0.0001")
            await auct.connect(seller).createAuction(
                startingPrice,
                3,
                "fake item",
                3
            )

            this.timeout(5000)
            await delay(4000)

            await expect(
                auct.connect(buyer)
                    .buy(0, {value: startingPrice})
            ).to.be.revertedWith('ended!');
        })

        it("reverts with message not enough funds!", async function() {
            await auct.connect(seller).createAuction(
                ethers.parseEther("0.0001"),
                3,
                "fake item",
                60
            )

            await expect(
                auct.connect(buyer)
                    .buy(0, {value: ethers.parseEther("0.00001")})
            ).to.be.revertedWith('not enough funds!');
        })

        it("emits event that auction is ended", async function() {
            await auct.connect(seller).createAuction(
                ethers.parseEther("0.0001"),
                1000000000000,
                "fake item",
                60
            )

            const buyTx = await auct.connect(buyer)
                .buy(0, {value: ethers.parseEther("0.0001")})

            const cAuction = await auct.auctions(0)
            const finalPrice = cAuction.finalPrice
            
            await expect(buyTx)
                .to.emit(auct, 'AuctionEnded')
                .withArgs(0, finalPrice, await buyer.getAddress());
        })
    })

    describe("getPriceFor", function() {
        it("reverts with message stopped!", async function() {
            await auct.connect(seller).createAuction(
                ethers.parseEther("0.0001"),
                3,
                "fake item",
                60
            )

            const buyTx = await auct.connect(buyer)
                .buy(0, {value: ethers.parseEther("0.0001")})
            
            await expect(auct.getPriceFor(0))
                .to.be.revertedWith('stopped!');
        })
    })
})