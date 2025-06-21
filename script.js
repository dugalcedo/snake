const CANVAS_SIZE = 650
const COLUMN_COUNT = 10
const SQUARE_SIZE = CANVAS_SIZE / COLUMN_COUNT
let FRAME_LENGTH_MS = 250
const canvas = document.querySelector('canvas#snake')
const ctx = canvas.getContext('2d')

let state = 'waiting'
let controlsLocked = false

const relativePath = (pathStartingWithSlash) => {
    let head = "."
    if (window.location.href.includes('github')) head += '/snake'
    return head + pathStartingWithSlash
}

// sounds
const sounds = {}
const createSound = (name, ext) => {
    sounds[name] = document.createElement('audio')
    sounds[name].src = relativePath(`/sounds/${name}.${ext}`)
}
createSound('beep', 'wav')
createSound('click', 'wav')
createSound('gameOver', 'wav')
const playSound = (name) => {
    sounds[name].play()
}

// ------objects-------

class Square {
    static spaceOccupiedBySnakeSegment(square) {
        return SnakeSegment.all.some(ss => ss.x === square.x && ss.y === square.y)
    }

    constructor(options) {
        this.x = options.x || 0
        this.y = options.y || 0
        this.padding = options.padding || 0
        this.fill = options.fill || 'white'
    }

    draw() {
        ctx.fillStyle = this.fill
        ctx.beginPath()
        ctx.rect(
            (this.x * SQUARE_SIZE) + this.padding,
            (this.y * SQUARE_SIZE) + this.padding, 
            SQUARE_SIZE - (this.padding * 2), 
            SQUARE_SIZE - (this.padding * 2)
        )
        ctx.fill()
    }

    move(xOrY, oneOrNegOne) {
        let val = this[xOrY]
        val += oneOrNegOne
        if (val < 0) {
            val = COLUMN_COUNT - 1
        } else if (val > COLUMN_COUNT - 1) {
            val = 0
        }
        this[xOrY] = val
    }
}

class Food extends Square {
    static all = []

    static sprinkle(amt = 1) {
        for (let i = 0; i < amt; i++) {
            const food = new Food({})
            food.draw()
        }
    }

    constructor(options) {
        super({
            ...options,
            padding: options.padding || SQUARE_SIZE/4,
            fill: 'lime '
        })

        this.x = randInt(0, COLUMN_COUNT - 1)
        this.y = randInt(0, COLUMN_COUNT - 1)

        // Attempt to find space that isn't occupied by a SnakeSegment
        let attempts = 0
        while (Square.spaceOccupiedBySnakeSegment(this)) {
            if (attempts >= 500) {
                throw new Error("Attempted to create a Food 500 times but the snake is taking up too much space.")
            }
            this.x = randInt(0, COLUMN_COUNT - 1)
            this.y = randInt(0, COLUMN_COUNT - 1)
            attempts += 1
        }

        Food.all.push(this)
    }

    getEaten() {
        const i = Food.all.findIndex(f => f.x === this.x && f.y === this.y)
        if (i === -1) {
            throw new Error(`A food is trying to getEaten but is not in Food.all.`)
        }
        Food.all.splice(i, 1)
        Food.sprinkle(1)
    }
}

class SnakeSegment extends Square {
    static all = []

    static get head() {
        return SnakeSegment.all[0]
    }

    static checkFoods() {
        const head = SnakeSegment.head
        const eatenFood = Food.all.find(f => f.x === head.x && f.y === head.y)
        if (!eatenFood) return;
        eatenFood.getEaten()
        head.grow()
    }

    static grow() {
        let [x, y] = SnakeSegment.getNextSegmentCoords()
        new SnakeSegment({ x, y })
        FRAME_LENGTH_MS -= 5
        playSound('beep')
    }

    static getNextSegmentCoords() {
        const last = SnakeSegment.all[SnakeSegment.all.length-1]
        switch (SnakeSegment.head.dir) {
            case "up":
                return [last.x, last.y+1]
            case "right":
                return [last.x-1, last.y]
            case "down":
                return [last.x, last.y-1]
            case "left":
                return [last.x+1, last.y]
        }
    }

    static checkSelf() {
        const head = SnakeSegment.head
        const colliding = SnakeSegment.all.some(ss => {
            return !ss.isHead && ss.x === head.x && ss.y === head.y
        })
        if (!colliding) return;

        // GAME OVER
        state = 'game over'
    }

    constructor(options) {
        super(options)

        // last pos
        this.lastX = options.x
        this.lastY = options.y

        // all
        this.i = SnakeSegment.all.length
        SnakeSegment.all.push(this)

        if (this.isHead) {
            this.dir = options.dir || 'right'
            this.fill = "orange"
        }

        // padding
        this.padding = 5
    }

    get isHead() {
        return this.i === 0
    }

    slither() {
        this.lastX = this.x
        this.lastY = this.y

        if (this.isHead) {
            // Head slither switch
            playSound('click')
            switch(this.dir) {
                case "up":
                    this.move('y', -1)
                    break
                case "right":
                    this.move('x', 1)
                    break
                case "down":
                    this.move('y', 1)
                    break
                case "left":
                    this.move('x', -1)
                    break
            }
        } else {
            // Body slither
            const headward = SnakeSegment.all[this.i-1]
            this.x = headward.lastX
            this.y = headward.lastY
        }
    }

    grow() {
        SnakeSegment.grow()
    }
}

// -----functions----

function initCanvas() {
    // canvas
    canvas.width = CANVAS_SIZE
    canvas.height = CANVAS_SIZE
    clear()

    // draw snake
    SnakeSegment.all.forEach(ss => ss.draw())

    // sprinkle food
    Food.sprinkle()

    // handle controls
    document.addEventListener('keydown', handleControls)
}

function start() {
    state = 'playing'
    frame()
}

function frame() {
    controlsLocked = false
    clear()
    // draw foods
    Food.all.forEach(f => f.draw())

    SnakeSegment.all.forEach(ss => {
        ss.slither()
        ss.draw()
    })

    // check if food eaten
    SnakeSegment.checkFoods()

    // check for self-collission
    SnakeSegment.checkSelf()

    // Go to next frame
    if (state !== 'playing') {
        switch (state) {
            case 'game over':
                gameOver()
                break
        }
        return
    }
    setTimeout(frame, FRAME_LENGTH_MS);
}

function clear() {
    ctx.fillStyle = "black"
    ctx.rect(0, 0, CANVAS_SIZE, CANVAS_SIZE)
    ctx.fill()
}

function randInt(min, max) {
    return Math.round(Math.random()*(max-min)+min)
}

function handleControls({ key }) {
    if (controlsLocked) return;
    controlsLocked = true;
    switch(key.toLowerCase()) {
        case 'w':
        case 'arrowup':
            if (SnakeSegment.head.dir === 'down') break;
            SnakeSegment.head.dir = 'up'
            break
        case 'a':
        case 'arrowleft':
            if (SnakeSegment.head.dir === 'right') break;
            SnakeSegment.head.dir = 'left'
            break
        case 's':
        case 'arrowdown':
            if (SnakeSegment.head.dir === 'up') break;
            SnakeSegment.head.dir = 'down'
            break
        case 'd':
        case 'arrowright':
            if (SnakeSegment.head.dir === 'left') break;
            SnakeSegment.head.dir = 'right'
            break
        case ' ':
            if (state === 'waiting') start();
    }
}

function gameOver() {
    ctx.fillStyle = 'rgba(255, 0, 0, 0.5)'
    ctx.beginPath()
    ctx.rect(0, 0, CANVAS_SIZE, CANVAS_SIZE)
    ctx.fill()

    ctx.font = "18px sans-serif"
    ctx.fillStyle = "white"
    ctx.fillText("GAME OVER", CANVAS_SIZE/2, CANVAS_SIZE /2)

    playSound('gameOver')
}

// -------main-----

function main() {
    new SnakeSegment({})

    initCanvas()
}
main()