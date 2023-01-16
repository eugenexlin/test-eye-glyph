import _, { before } from "lodash";
import * as React from "react";
import type { HeadFC, PageProps } from "gatsby";
import { stringify } from "querystring";

const editRowStyle = {
	width: "1px",
	display: "flex",
	fontSize: "16px",
};
const editBoxStyle: React.CSSProperties = {
	flex: 1,
	margin: "2px",
	padding: "8px",
	border: "1px solid #ddd",
	textAlign: "center",
};
const editBox: React.CSSProperties = {
	width: "80px",
};

const occurancesStyle: React.CSSProperties = {
	display: "inline-block",
};

const zoneStyle: React.CSSProperties = {
	display: "inline-block",
};

const nonZoneStyle: React.CSSProperties = {
	opacity: 0.2,
};

const transLine: React.CSSProperties = {
	marginBottom: "8px",
};

const letterStyle: React.CSSProperties = {
	display: "inline-block",
	borderStyle: "solid",
	borderWidth: "2px",
	width: "16px",
	height: "20px",
	textAlign: "center",
};

const east1 = [
	"201013223304041130232114313033004024000",
	"032041220001422242122220110003201341113",
	"310221044000200104040144142033022034241",
	"231313130031132120142231331441341441211",
	"014003212114130041110100241241004031001",
	"040331432341122101010040120412442442402",
	"13331220330103113111211210322314",
	"1310424224130304110203123204313",
];
const west1 = [
	"311013223304041130232114313033004024004",
	"032041220001422242122220110003201341101",
	"020201044000104044040144142033022034131",
	"111213130001102020142231331441341441401",
	"212223303244000243231110221231031022043",
	"403431401222111340210301413341221330132",
	"02414221422203024200123212402323201403",
	"3101322112130203222200422310313224113",
];
const east2 = [
	"121013223304041130232114313033004024004",
	"132041220001422242122220110003201341132",
	"302013230044210143001214140311024104223",
	"102441113222231403330130231010322441422",
	"014113030144102020311114241034232132112",
	"141120120040103022122402040000103221040",
	"001132210042231043242013103010200300221",
	"020142240312031330231000103310441201422",
	"034201043101100200124",
	"131402022020141322311",
];
const west2 = [
	"301014304231111130103200114211142042144",
	"132041002441200222141013240022220120402",
	"110120210044012022014100202130013243312",
	"401130112010322313431422313213031100003",
	"143110223024224201021223142200103111223",
	"203401230041222213132220230242140211440",
	"122201000012143101233312010224203221",
	"011010101321231103032030241320322030",
];
const east3 = [
	"221014304000100302220231222232144144211",
	"332041002222431341003242000010220042431",
	"313223312120134004141302310001231043130",
	"020020140002021212311100003112220110032",
	"140214222023042001214241211223104010034",
	"003021031300212210310000312332003240422",
	"001240241020232043043031224131312301142",
	"232311130211021020222341412113240321230",
	"001030124221224033003211024213133231001",
	"410210103300432031412111422330403400041",
	"04124012304",
	"0423010104",
];
const west3 = [
	"111014304044023101033232120113240032023",
	"432041002342120301441212222401420211130",
	"033031134224144111303003142234042131112",
	"431413200210141202112431230203111430021",
	"103133214200230011143034143033110122120",
	"101132211120442310131321231020311022200",
	"120120123130011024014133021023002220044",
	"210312220001440122003232142141332131220",
	"120224022234203033120244040200",
	"002121100141102242103402411442",
];
const east4 = [
	"101014304000100000010213233120142133003",
	"232041002222431212430430300110203421130",
	"101004223210034300144214224022200300022",
	"303411022313202403302030222441142010141",
	"143234300120242230110301302001040030130",
	"012332401341341302441301412412222303322",
	"212222143130302013102113102230003103232",
	"432331411032403200122103112431440120231",
	"12202423010131123221303",
	"3421210220100323034034",
];
const west4 = [
	"301014304000100000010213233120140040002",
	"232041002222431212430430300110222113142",
	"211310214001032122241124300100131223313",
	"030221230132301430413420300032332421140",
	"040210240103202210243021012103012033232",
	"402211103132412102142440311122021431141",
	"204233241203302023301041204241012232101",
	"311140311421232122410240132440030221440",
	"224314114042121114140130",
	"020231000031000102140011",
];
const east5 = [
	"111014304000100000010213233120143044133",
	"332041002222431212430430300110211112430",
	"101214223302024014144212222230212213233",
	"303411022401202041302002242420240341202",
	"014110114103111010240110204010013100130",
	"211211130110441211112403410122040041213",
	"102041041221134130133013243011042010221",
	"020203002240010120442311042111142031102",
	"131224220222041",
	"232442101331431",
];
const west5 = [];

const mapEyeToDir = (ch: string): number[] => {
	switch (parseInt(ch)) {
		case 0:
			return [0, 0];
		case 1:
			return [0, 1];
		case 2:
			return [1, 0];
		case 3:
			return [0, -1];
		case 4:
			return [-1, 0];
	}
	return [0, 0];
};

interface LetterData {
	coord: number[];
	skip?: boolean;
}

const addCoord = (coord1: number[], coord2: number[], coord3: number[]) => {
	return [
		3 + coord1[0] + coord2[0] + coord3[0],
		3 + coord1[1] + coord2[1] + coord3[1],
	];
};

const zip2String = (str1: string, str2: string) => {
	let index = 0;
	let result: string[] = [];
	while (index < str1.length || index < str2.length) {
		if (index < str1.length) {
			result.push(str1.charAt(index));
		}
		if (index < str2.length) {
			result.push(str2.charAt(index));
		}
		index += 1;
	}
	return result.join("");
};

const getColorFromCoord = (coord: number[]) => {
	let r = 255;
	let g = 255;
	let b = 255;
	if (coord[0] <3){
		g = Math.max(0, g - 80*(3-coord[0]))
	}
	if (coord[1] <3){
		r = Math.max(0, r - 80*(3-coord[1]))
	}
	if (coord[0] >3){
		b = Math.max(0, b - 80*(coord[0] - 3))
	}
	if (coord[1] >3){
		r = Math.max(0, r - 60*(coord[1] - 3))
		g = Math.max(0, g - 60*(coord[1] - 3))
		b = Math.max(0, b - 60*(coord[1] - 3))
	}
	return "rgb(" + r + " ,  " + g + ", " + b + ")";
};

const IndexPage: React.FC<PageProps> = () => {
	const [lettersMatrix, setLettersMatrix] = React.useState([
		["", "", "", "X", "", "", ""],
		["", "", "X", "X", "X", "", ""],
		["", "X", "X", "H", "X", "X", ""],
		["X", "X", "X", "X", "X", "X", "X"],
		["", "X", "X", "X", "S", "X", ""],
		["", "", "X", "X", "X", "", ""],
		["", "", "", "X", "", "", ""],
	]);

	const getLetterFromCoord = (coord: number[]) => {
		return lettersMatrix[coord[0]][coord[1]];
	};

	const occurrances = [
		[0, 0, 0, 0, 0, 0, 0],
		[0, 0, 0, 0, 0, 0, 0],
		[0, 0, 0, 0, 0, 0, 0],
		[0, 0, 0, 0, 0, 0, 0],
		[0, 0, 0, 0, 0, 0, 0],
		[0, 0, 0, 0, 0, 0, 0],
		[0, 0, 0, 0, 0, 0, 0],
	];

	const handleChangeLetter: (
		x: number,
		y: number
	) => React.ChangeEventHandler<HTMLInputElement> =
		(x: number, y: number) => (event) => {
			event.target.textContent;
			const newLetters = _.cloneDeep(lettersMatrix);
			console.warn(event);
			if (event.target.value) {
				newLetters[x][y] = event.target.value;
			} else {
				newLetters[x][y] = "";
			}
			setLettersMatrix(newLetters);
		};

	const processLines = [
		east1,
		west1,
		east2,
		west2,
		east3,
		west3,
		east4,
		west4,
		east5,
	];

	const output: LetterData[][] = [];

	processLines.forEach((line) => {
		let lineIndex = 0;
		while (lineIndex < line.length) {
			const lineData: string = zip2String(line[lineIndex], line[lineIndex + 1]);
			let lineDataIndex = 0;
			const singleStatement: LetterData[] = [];
			while (lineDataIndex < lineData.length) {
				let coord = addCoord(
					mapEyeToDir(lineData.charAt(lineDataIndex)),
					mapEyeToDir(lineData.charAt(lineDataIndex + 1)),
					mapEyeToDir(lineData.charAt(lineDataIndex + 2))
				);

				occurrances[coord[0]][coord[1]] = occurrances[coord[0]][coord[1]] + 1;
				// console.info(coord.toString());
				singleStatement.push({ coord });
				lineDataIndex += 3;
			}

			output.push(singleStatement);
			lineIndex += 2;
		}
		output.push([]);
	});

	return (
		<main>
			<div>
				{lettersMatrix.map((lettersRow, letterx) => {
					return (
						<div style={editRowStyle}>
							{lettersRow.map((letter, lettery) => {
								const distFromZone =
									Math.abs(letterx - 3) + Math.abs(lettery - 3);
								const isInZone: boolean = distFromZone <= 3;
								return (
									<div style={editBoxStyle}>
										<div style={occurancesStyle}>
											{occurrances[letterx][lettery]}
										</div>
										<div
											style={
												isInZone
													? {
															...zoneStyle,
															boxShadow:
																"0px 0px 0px 2px " +
																getColorFromCoord([letterx, lettery]),
													  }
													: nonZoneStyle
											}
										>
											<input
												style={editBox}
												type={"text"}
												value={letter}
												onChange={handleChangeLetter(letterx, lettery)}
											></input>
										</div>

										{}
									</div>
								);
							})}
						</div>
					);
				})}
				{output.map((translatedLine) => {
					let alternateGetNext = true;
					if (translatedLine.length === 0){
						return <hr></hr>
					}
					return (
						<div style={{ ...transLine }}>
							{translatedLine.map((letter) => {
								const value = getLetterFromCoord(letter.coord);
								const showMe = alternateGetNext || value === " ";
								alternateGetNext = !alternateGetNext;
								if (value === " ") {
									alternateGetNext = true;
								}
								return (
									<div
										style={{
											...letterStyle,
											...(showMe ? {} : { display: "none" }),
											borderColor: getColorFromCoord(letter.coord),
										}}
									>
										{getLetterFromCoord(letter.coord)}
									</div>
								);
							})}
						</div>
					);
				})}
			</div>
		</main>
	);
};

export default IndexPage;

export const Head: HeadFC = () => <title>Eye Glyphs</title>;
