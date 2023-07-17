import {
    Scene,
    PerspectiveCamera,
    WebGLRenderer,
    ConeGeometry,
    MeshBasicMaterial,
    Vector3,
    Mesh
} from "three";

// Simple scene setting
const scene = new Scene();
const camera = new PerspectiveCamera( 75, window.innerWidth / window.innerHeight, 0.1, 1000 );
const renderer = new WebGLRenderer();
renderer.setSize( window.innerWidth, window.innerHeight );
document.body.appendChild( renderer.domElement );
camera.position.z = 200;

// Constants
const INSECT_SHAPE = new ConeGeometry( 1, 5, 6 );
INSECT_SHAPE.rotateX( Math.PI * 0.5 );
const INSECT_MATERIAL = new MeshBasicMaterial( { color: 0x00ff00} );
const INSECT_COUNT = 100;
const X_LIM = 135;
const Y_LIM = 73;
const Z_LIM = 75;
const VELOCITY_LIM = 1.5;
const SEPARATION_RADIUS = 15;
const ALIGNMENT_RADIUS = 60;
const COHESION_RADIUS = 70;
const LIM_FACTOR = 0.2;
const SEPARATION_FACTOR = 0.07;
const ALIGNMENT_FACTOR = 0.05;
const COHESION_FACTOR = 0.03;
const NOISE_ANGLE = Math.PI/4;
const NOISE_FACTOR = 0.5;
const STEPS = 1000; 

////////////   Helper functions   ////////////

/**
 * Calculates wether or not two insects are withing a certain
 * distance range of each other.
 * 
 * @param insect1 The first insect.
 * @param insect2 The second insect.
 * @param range   The range to test against.
 * 
 * @returns  Whether or not the two insects are withing the given range.
 */
const withinDistance = (
    insect1: Mesh,
    insect2: Mesh,
    range: number
): boolean => {
	const distance = insect1.position.distanceTo(insect2.position);
	return distance <= range;
}


/**
 * Get all the insects from a list that are within a range of an insect.
 * 
 * @param mainInsect An insect.
 * @param insectList A list of insects.
 * @param range      The range to test against.
 * 
 * @returns the list of insects within range.
 */ 
const getInsectsWithinDistance = (
    mainInsect: Mesh,
    insectList: Mesh[],
    range: number
): Mesh[] => {
	const insectsWithninDistance = insectList.filter(insect => withinDistance(mainInsect, insect, range));
	return insectsWithninDistance;
}


/**
 * Calculate the average velocity of a list of insects
 * 
 * @param insectList A list of insects.
 * @param insectVelocities the insects' velocities
 * 
 * @returns the avererage velocity of the insects
 */
const calculateAverageVelocity = (
    insectList: Mesh[],
    insectVelocities: Record<string, Vector3>
): Vector3 => {
    const averageVelocity = new Vector3();
    insectList.forEach(insect => {
        averageVelocity.add(insectVelocities[insect.id]);
    });
    averageVelocity.divideScalar(insectList.length);
    return averageVelocity;
}


/**
 * Calculate and return the average position of list of insects.
 * 
 * @param insectList A list of insects.
 * 
 * @returns The average position of the insects.
 */
const calculateAveragePosition = (insectList: Mesh[]): Vector3 => {
	const averagePosition = new Vector3();
	insectList.forEach(insect => {
		averagePosition.add(insect.position);
	});
	averagePosition.divideScalar(insectList.length);

	return averagePosition;
}


////////////   Algorithm functions   ////////////

/**
 * Get a path correction vector to cohere an insect to its neighbors
 * 
 * @param insect     The insect to correct
 * @param insectList A list of insects.
 * 
 * @returns a correction vector
 */
const getCoherenceCorrection = (insect: Mesh, insectList: Mesh[]): Vector3 => {
    const coherenceInsects = getInsectsWithinDistance(insect, insectList, COHESION_RADIUS);
    const coherenceVector = new Vector3();
    if (coherenceInsects.length > 0 ){
        const averagePosition = calculateAveragePosition(coherenceInsects);
        coherenceVector.subVectors(averagePosition, insect.position);
        coherenceVector.multiplyScalar(COHESION_FACTOR);
    }
    return coherenceVector;
}


/**
 * Get a path correction vector to separate an insect to its neighbors
 * 
 * @param insect The insect to correct
 * @param insectList A list of insects.
 * 
 * @returns a separation vector
 */
const getSeparationCorrection = (insect: Mesh, insectList: Mesh[]): Vector3 => {
    const separationInsects = getInsectsWithinDistance(insect, insectList, SEPARATION_RADIUS);
    const separationVector = new Vector3();
    if (separationInsects.length > 0){
        const averagePosition = calculateAveragePosition(separationInsects);
        separationVector.subVectors(insect.position, averagePosition);
        separationVector.multiplyScalar(SEPARATION_FACTOR);
    }
    return separationVector;
}


/**
 * Get a path correction vector to align an insect to its neighbors
 * 
 * @param insect     The insect to correct
 * @param insectList A list of insects.
 * @param insectVelocities the insects' velocities
 * 
 * @returns an alignment vector
 */
const getAlignmentCorrection = (
    insect: Mesh,
    insectList: Mesh[],
    insectVelocities: Record<string, Vector3>
): Vector3 => {
    const alignmentInsects = getInsectsWithinDistance(insect, insectList, ALIGNMENT_RADIUS);
    const alignmentVector = new Vector3();
    if (alignmentInsects.length > 0){
        const alignmentVector = calculateAverageVelocity(alignmentInsects, insectVelocities).clone();
        alignmentVector.multiplyScalar(ALIGNMENT_FACTOR);
    }
    return alignmentVector;
}


/**
 * Get a path correction vector to keep insect inside the scene bounds
 * 
 * @param insect The insect to correct
 * 
 * @returns an bounds correction vector
 */
const getBoundsCorrection = (insect: Mesh): Vector3 => {
    const boundsCorrectionLess= new Vector3(
        insect.position.x < -X_LIM ? LIM_FACTOR : 0,
        insect.position.y < -Y_LIM ? LIM_FACTOR : 0,
        insect.position.z < -Z_LIM ? LIM_FACTOR : 0,
    );
    const boundsCorrectionMore = new Vector3(
        insect.position.x > X_LIM ? -LIM_FACTOR : 0,
        insect.position.y > Y_LIM ? -LIM_FACTOR : 0,
        insect.position.z > Z_LIM ? -LIM_FACTOR : 0,
    );
    return boundsCorrectionLess.add(boundsCorrectionMore);
}


/**
 * Get a path correction vector to apply noise-induced alignment to an insect
 * 
 * @param insect     The insect to correct
 * @param insectList A list of insects.
 * @param insectVelocities the insects' velocities
 * 
 * @returns an noise alignment vector
 */
const getNoiseAlignmentCorrections = (
    insect: Mesh,
    insectList: Mesh[],
    insectVelocities: Record<string, Vector3>
): Vector3 => {
    const alignmentInsects = getInsectsWithinDistance(insect, insectList, ALIGNMENT_RADIUS);
    const alignmentVector = new Vector3();
    let withinAlignmentLimit = false;
    if (alignmentInsects.length > 0){
        const averageVelocity = calculateAverageVelocity(alignmentInsects, insectVelocities).clone();
        const insectVelocity = insectVelocities[insect.id];
        const misalignment = insectVelocity.angleTo(averageVelocity);
        withinAlignmentLimit = misalignment < NOISE_ANGLE;
    }

    if (!withinAlignmentLimit){
        alignmentVector.randomDirection();
        alignmentVector.setLength(Math.random() * VELOCITY_LIM);
    }
    alignmentVector.multiplyScalar(NOISE_FACTOR);

    return alignmentVector;
}


/**
 * Calculate the new velocity for an insect
 * 
 * @param insect     The insect for which to compute velocity
 * @param insectList A list of other insects.
 * @param insectVelocities the insects' velocities
 * 
 * @returns The calculated insect velocity
 */
const getNewVelocity = (
    insect: Mesh,
    insectList: Mesh[],
    insectVelocities: Record<string, Vector3>
): Vector3 => {
    let newVelocity = insectVelocities[insect.id].clone();
    newVelocity.add(getSeparationCorrection(insect,insectList))
    newVelocity.add(getAlignmentCorrection(insect,insectList, insectVelocities));
    newVelocity.add(getCoherenceCorrection(insect,insectList));
    newVelocity.add(getBoundsCorrection(insect));
    newVelocity.add(getNoiseAlignmentCorrections(insect,insectList, insectVelocities));
    newVelocity.clampLength(0, VELOCITY_LIM); // limit velocity
    return newVelocity
}


/**
 * Update the position of a list of insects
 * 
 * @param insectList A list of insects.
 * @param insectVelocities the insects' velocities
 */
const updatePositions = (insectList: Mesh[], insectVelocities: Record<string, Vector3>) => {
	insectList.forEach(insect => {
        const insectsMinusOne = insectList.filter(i => i.id !== insect.id);
        const newVelocity = getNewVelocity(insect, insectsMinusOne, insectVelocities);
        insectVelocities[insect.id] = newVelocity;
        const oldPosition = insect.position;
        const newPosition = new Vector3();
        newPosition.addVectors(oldPosition, newVelocity);
        insect.lookAt(newPosition);
        insect.position.fromArray(newPosition.toArray());
	});
}


////////////   Main Script   ////////////


// Initialize insects in scene
const insects: Mesh[] = [];
const insectVelocities: Record<string, Vector3> = {};
for (let i = 0; i < INSECT_COUNT ; i++){
	const insect = new Mesh( INSECT_SHAPE, INSECT_MATERIAL );
	insects.push(insect)
	scene.add(insect)

	// give it a random starting position
	const randomX =( Math.random() * X_LIM * 2) - X_LIM;
	const randomY =( Math.random() * Y_LIM * 2) - Y_LIM;
	const randomZ =( Math.random() * Z_LIM * 2) - Z_LIM;
	insect.position.set(randomX, randomY, randomZ);

    // give it a random starting velocity
	const randomVX =( Math.random() * VELOCITY_LIM * 2) - VELOCITY_LIM;
	const randomVY =( Math.random() * VELOCITY_LIM * 2) - VELOCITY_LIM;
	const randomVZ =( Math.random() * VELOCITY_LIM * 2) - VELOCITY_LIM;
    const insectVelocity = new Vector3(randomVX, randomVY, randomVZ);
    insectVelocities[insect.id] = insectVelocity;
}

let stepCounter = 0
const animate = () => {
	requestAnimationFrame( animate );

	if(stepCounter < STEPS){
		updatePositions(insects, insectVelocities);
		stepCounter++;
	}

	renderer.render( scene, camera );
}

animate();
