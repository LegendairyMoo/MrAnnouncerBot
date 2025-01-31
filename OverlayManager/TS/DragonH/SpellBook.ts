﻿enum LayoutStyle {
	normal = 0,
	bold = 1,
	italic = 2,
	calculated = 3
}

enum Justification {
	left,
	right,
	center
}

class Column {
	width: number = 0;
	justification: Justification = Justification.left;
	lineWrapData: LineWrapData;

	determineAlignment(cellContents: string): any {
		// Expecting one of these three patterns: ':---', ':----:', or '---:'
		if (cellContents.startsWith(':'))
			if (cellContents.endsWith(':'))
				this.justification = Justification.center;
			else
				this.justification = Justification.left;
		else if (cellContents.endsWith(':'))
			this.justification = Justification.right;
		else
			this.justification = Justification.left;
	}

	adjustWidth(newWidth: number) {
		if (this.width < newWidth)
			this.width = newWidth;
	}

	constructor() {

	}
}

class LayoutDelimiters {
	inPair: boolean;
	needToClose: boolean;
	lastStart: number;
	constructor(public style: LayoutStyle, public startDelimiter: string, public endDelimiter: string, public fontYOffset: number = 0) {

	}
}

class Span {
	constructor(public startOffset: number, public stopOffset: number, public style: LayoutStyle) {

	}
}

class Table {
	columns: Array<Column>;
	private _width: number = 0;

	get width(): number {
		if (this._width === 0)
			this.calculateTableWidth();
		return this._width;
	}

	set width(newValue: number) {
		this._width = newValue;
	}

	calculateTableWidth(): any {
		let tableWidth: number = 0;
		this.columns.forEach(function (column: Column) {
			tableWidth += column.width + 2 * SpellBook.tableCellHorizontalMargin;
		});
		this._width = tableWidth;
	}

	getColumnByIndex(columnIndex: number): any {
		if (!this.columns)
			this.columns = [];
		while (this.columns.length < columnIndex + 1)
			this.columns.push(new Column());
		return this.columns[columnIndex];
	}

	createColumns(lineData: Array<LineWrapData>, context: CanvasRenderingContext2D) {
		this.columns = [];
		for (let i = 0; i < lineData.length; i++) {
			let lineDataThisLine: LineWrapData = lineData[i];
			this.collectColumnInfo(lineDataThisLine, context);
		}
	}
	collectColumnInfo(lineDataThisLine: LineWrapData, context: CanvasRenderingContext2D): void {
		let columnIndex: number = 0;
		let line: string = lineDataThisLine.line.trim();
		if (line.startsWith('|'))
			line = line.substr(1);

		let pipePos: number = line.indexOf('|');
		while (pipePos >= 0) {
			let column: Column = this.getColumnByIndex(columnIndex);

			let cellContents: string = line.substr(0, pipePos).trim();
			if (cellContents.indexOf('---') >= 0) {
				column.determineAlignment(cellContents);
			}
			else {
				// Regular contents.
				// TODO: Add formatting support for cells?????
				let cellWidth: number = context.measureText(cellContents).width;
				column.adjustWidth(cellWidth);
			}
			line = line.substr(pipePos + 1);
			pipePos = line.indexOf('|');
			columnIndex++;
		}
	}
	constructor(public id: number) {

	}
}

class ParagraphWrapData {
	lineData: Array<LineWrapData>;
	tables: Array<Table>;
	private _maxTableWidth: number = 0;

	get maxTableWidth(): number {
		if (this._maxTableWidth === 0)
			this.calculateMaxTableWidth();
		return this._maxTableWidth;
	}

	set maxTableWidth(newValue: number) {
		this._maxTableWidth = newValue;
	}

	calculateMaxTableWidth() {
		let tableWidth: number = 0;
		for (let i = 0; i < this.tables.length; i++) {
			let thisTable: Table = this.tables[i];
			if (thisTable.width > tableWidth)
				tableWidth = thisTable.width;
		}
		this._maxTableWidth = tableWidth;
	}

	createTables(context: CanvasRenderingContext2D) {
		this.tables = [];

		let tableLines: Array<LineWrapData>;

		let inTable: boolean = false;
		let activeTable: Table = null;
		let tableId: number = 0;

		this.lineData.forEach(function (lineWrapData: LineWrapData) {
			if (!inTable && lineWrapData.inTableRow) {
				inTable = true; // Entered a new table!!!
				activeTable = new Table(tableId);
				this.tables.push(activeTable);
				tableId++;

				tableLines = [];

				tableLines.push(lineWrapData);
				lineWrapData.table = activeTable;
			}
			else if (inTable && lineWrapData.inTableRow) {
				tableLines.push(lineWrapData);
				lineWrapData.table = activeTable;
			}
			else if (inTable) {
				inTable = false;
				activeTable.createColumns(tableLines, context);
				tableLines = [];
			}
		}, this);

		if (inTable) {
			activeTable.createColumns(tableLines, context);
		}
	}

	constructor() {

	}
}

class LineWrapData {
	table: Table = null;
	constructor(public line: string, public allSpans: Array<Span>, public width: number, public indent: number = 0, public isBullet: boolean = false, public inTableRow: boolean = false) {

	}
}

class SpellBook {
	// titles:
	static readonly str_CastingTime: string = 'Casting Time: ';
	static readonly str_Range: string = 'Range: ';
	static readonly str_Components: string = 'Components: ';
	static readonly str_Duration: string = 'Duration: ';

	static readonly str_ConcentrationPrefix: string = 'Concentration, ';

	// appearance:
	static readonly titleFontName: string = 'Modesto Condensed Bold';
	static readonly detailFontName: string = 'mrs-eaves';
	static readonly titleFontIdealSize: number = 30;
	static readonly titleLeftMargin: number = 25;
	static readonly titleFirstIconSpacing: number = 10;
	static readonly iconSpacing: number = 8;
	static readonly iconScaleDenominator: number = 38; // Divide title font size by this to get concentration icon scale
	static readonly titleFontCenterYAdjust: number = 3;
	static readonly iconSize: number = 36;
	static readonly detailFontSize: number = 18;
	static readonly castingSubDetailIndent: number = 8;
	static readonly spellDetailsWidth: number = 220;
	static readonly schoolOfMagicIndent: number = 20;
	static readonly schoolOfMagicWidth: number = 115 + SpellBook.schoolOfMagicIndent;
	static readonly spellDescriptionWidth: number = 320;
	static readonly titleLevelMargin: number = 3;
	static readonly tableCellHorizontalMargin: number = 8;
	static readonly detailSpacing: number = 4;
	static readonly emphasisFontYOffsetForChrome: number = -2;
	static readonly emphasisFontYOffsetForObs: number = -3;
	static readonly emphasisLineYOffsetForChrome: number = 0;
	static readonly emphasisLineYOffsetForObs: number = 2;
	static readonly abjurationAdjust: number = 4;
	static readonly emphasisFontHeightIncrease: number = 3;
	static readonly emphasisFontStyleAscender: number = 19;
	static readonly bulletIndent: number = SpellBook.detailFontSize * 1.2;

	static styleDelimiters: Array<LayoutDelimiters>;

	static readonly levelDetailsMargin: number = 6;
	static readonly maxSpellBookHeight: number = 1000;

	static readonly bookSpellHeightAdjust: number = 19; // Magic number based on spell book height calculations - always seem to be off by 12.

	// ![](F8879E41D1F82E6B2F1C5885DBB02DD4.png)
	static readonly bookGlowTopMargin: number = 85;

	// ![](09A034744A84F0C0C4A81FD1E58B7ED2.png)
	static readonly bookGlowLeftMargin: number = 88;

	// ![](2DF27D9DAA37DB8F3F1EF93291E493C7.png;;;0.01472,0.01472)
	static readonly bookGlowHeight: number = 626;

	// ![](EC5995AEDA28089361922471641200D0.png;;;0.00982,0.00982)
	static readonly fredHeadX: number = 355;  // right side of Fred's arrows.
	static readonly fredHeadY: number = 710;  // top of Fred's head.
	static readonly fredShoulderX: number = 380;  // top of Fred's shoulder.
	static readonly fredShoulderY: number = 893;  // right side of Fred's shoulder.

	// positioning logic:
	// 1. Can we get the spell above Fred's head.
	// 2. If not, move it to the top of the screen and to the right of Fred's head.

	static readonly spellPageRightEdge: number = 350;
	static readonly maxTitleWidth: number = SpellBook.spellPageRightEdge - SpellBook.titleLeftMargin;

	static readonly bottomWindowHeight: number = 1080;
	static readonly spellBottomHeight: number = 1022;

	// ![](C1C6705D2CAADF7C85591DA2A1E0A6DF.png)
	static readonly spellBottomMargin: number = 23;

	// ![](C1726232AA0D358FB5CC3FE2FE14D260.png)  schoolOfMagicHeight
	static readonly schoolOfMagicHeight: number = 109;

	// ![](ADB813D0BFBAA54EC6A49957A0FB6E2E.png)
	static readonly schoolOfMagicAbjurationHeight: number = 117;

	// ![](BCA0565D701D0D116C5132DE9B222FD6.png)
	static readonly spellHeaderHeight: number = 79;
	static readonly textColor: string = '#2d1611';
	static readonly bulletColor: string = '#5b3c35';
	static readonly emphasisColor: string = '#a01a00';
	static readonly tableLineColor: string = '#5b3c35';

	spellBookBack: Sprites;
	spellBookTop: Sprites;
	schoolOfMagic: Sprites;
	concentrationIcon: Sprites;
	morePowerIcon: Sprites;
	bookGlow: Sprites;
	lastPlayerId: number;
	calculatedFontYOffset: number = 0;
	lastSpellName: string;
	titleTopLeft: Vector;
	levelSchoolTopLeft: Vector;
	titleColors: Array<string>;
	hueShifts: Array<number>;
	titleFontSize: number = SpellBook.titleFontIdealSize;
	spellDetailsTopLeft: Vector;
	spellDescriptionTopLeft: Vector;
	spellBookBackHeight: number = 0;
	horizontalScale: number = 1;
	activeStyle: LayoutStyle;
	descriptionParagraphs: ParagraphWrapData;
	titleWidth: number;
	lastSpellSlotLevel: number;
	wrappedSubCastingLines: LineWrapData[];
	wrappedSubRangeLines: LineWrapData[];
	wrappedSubComponentMaterialLines: LineWrapData[];
	castingTime: string;
	componentSummary: string;
	rangeSummary: string;
	availableSpellDetailsWidth: number;
	schoolOfMagicAdjust: number;
	underlineOffset: number;
	browserIsObs: boolean;

	constructor(browserIsObs: boolean) {
		this.browserIsObs = browserIsObs;
		if (browserIsObs) {
			this.calculatedFontYOffset = SpellBook.emphasisFontYOffsetForObs;
			this.underlineOffset = SpellBook.emphasisLineYOffsetForObs;
		}
		else {
			this.calculatedFontYOffset = SpellBook.emphasisFontYOffsetForChrome;
			this.underlineOffset = SpellBook.emphasisLineYOffsetForChrome;
		}
		

		SpellBook.styleDelimiters = [
			new LayoutDelimiters(LayoutStyle.calculated, '«', '»', this.calculatedFontYOffset),
			new LayoutDelimiters(LayoutStyle.bold, '**', '**'),
			new LayoutDelimiters(LayoutStyle.italic, '*', '*')
		];

		this.loadFonts();
		this.loadColors();
	}

	private loadColors() {
		this.titleColors = [];
		this.titleColors.push('#000000'); // None
		this.titleColors.push('#2a6470'); // Abjuration    
		this.titleColors.push('#414695'); // Illusion			 
		this.titleColors.push('#602f81'); // Conjuration	 
		this.titleColors.push('#7b2f56'); // Enchantment   
		this.titleColors.push('#733831'); // Necromancy    
		this.titleColors.push('#216333'); // Evocation			
		this.titleColors.push('#2c5818'); // Transmutation	
		this.titleColors.push('#594f09'); // Divination

		this.hueShifts = [];
		this.hueShifts.push(0); // None
		this.hueShifts.push(191); // Abjuration     
		this.hueShifts.push(238); // Illusion			 
		this.hueShifts.push(277); // Conjuration	   
		this.hueShifts.push(331); // Enchantment    
		this.hueShifts.push(7);		// Necromancy     
		this.hueShifts.push(137); // Evocation			 
		this.hueShifts.push(101); // Transmutation	 
		this.hueShifts.push(52);  // Divination		 
	}

	private getWordWrappedLines(context: CanvasRenderingContext2D, text: string, maxScaledWidth: number): Array<LineWrapData> {
		let words = text.split(' ');
		let lines: Array<LineWrapData> = [];

		let currentLine: string = '';

		let allSpans: Array<Span> = [];
		let isBullet: boolean = false;
		let indent: number = 0;
		let inTableRow: boolean;
		let wordWrappingThisLine: boolean = true;
		let lineWidth: number = 0;
		let activeStyle: LayoutStyle = LayoutStyle.normal;

		let lastPart: string = '';

		for (var i = 0; i < words.length; i++) {
			let word = words[i];
			if (i == 0) {
				if (word == '*') {
					isBullet = true;
					indent = SpellBook.bulletIndent;
					continue;
				}
				if (word.startsWith('|')) {
					word = word.substr(1);
					inTableRow = true;
					currentLine = text;
					lineWidth = -1;
					break; // No support for formatting inside tables as long as we are breaking here.
					// We could continue to collect formatting, but NOT check for word wrap (set wordWrappingThisLine to false).
				}
			}

			let firstPart: string = '';
			lastPart = '';

			SpellBook.styleDelimiters.forEach(function (styleDelimeters: LayoutDelimiters) {
				styleDelimeters.needToClose = false;
				if (!styleDelimeters.inPair) {
					let delimiterStartIndex: number = word.indexOf(styleDelimeters.startDelimiter);
					if (delimiterStartIndex >= 0) {
						firstPart = word.substr(0, delimiterStartIndex);
						word = word.substr(delimiterStartIndex + styleDelimeters.startDelimiter.length);
						let startOffset: number = firstPart.length;
						if (startOffset > 0)
							startOffset++;
						styleDelimeters.lastStart = currentLine.length + startOffset;
						styleDelimeters.inPair = true;
						activeStyle = styleDelimeters.style;
					}
				}

				//if (word.startsWith(styleDelimeters.startDelimiter)) {
				//	word = word.substr(styleDelimeters.startDelimiter.length);
				//	styleDelimeters.lastStart = currentLine.length;
				//	styleDelimeters.inPair = true;
				//	activeStyle = styleDelimeters.style;
				//}

				// Catches **this bold**: delimeter (where ending bold delimiter is not followed by a space).
				let endDelimeterIndex = word.indexOf(styleDelimeters.endDelimiter);
				if (endDelimeterIndex > 0) {
					lastPart = word.substr(endDelimeterIndex + styleDelimeters.endDelimiter.length, word.length - endDelimeterIndex);
					word = word.substr(0, endDelimeterIndex);
					styleDelimeters.needToClose = true;
				}
			}, this);


			var thisWord: string = '';
			if (currentLine)
				thisWord = ' ' + word;
			else {
				thisWord = word;
				lineWidth = indent;
			}

			let firstPartWidth: number = 0; // e.g., a "(" in "(**"
			if (firstPart) {
				firstPartWidth = context.measureText(firstPart).width;
			}

			this.setActiveStyle(context, activeStyle);
			let thisWordWidth: number = context.measureText(thisWord).width;

			if (!wordWrappingThisLine || lineWidth + thisWordWidth + firstPartWidth < maxScaledWidth - indent) {  // Words still fit on this line.
				if (currentLine) {
					currentLine += ' ' + firstPart + word + lastPart;
					lineWidth += firstPartWidth + thisWordWidth;
				}
				else {
					currentLine = firstPart + word + lastPart;
					lineWidth = indent + firstPartWidth + thisWordWidth;
				}
			}
			else {  // We are wrapping to the next line!!!
				SpellBook.styleDelimiters.forEach(function (styleDelimeters: LayoutDelimiters) {
					if (styleDelimeters.inPair) {
						allSpans.push(new Span(styleDelimeters.lastStart, currentLine.length, styleDelimeters.style));
						styleDelimeters.lastStart = firstPart.length; // Still in the pair!!!
						//styleDelimeters.inPair = false;  // Looks wrong to me on review.
					}
				}, this);

				lines.push(new LineWrapData(currentLine, allSpans, lineWidth, indent, isBullet));
				isBullet = false;
				currentLine = firstPart + word + lastPart;
				lineWidth = thisWordWidth;
				allSpans = [];

				if (lastPart) {
					SpellBook.styleDelimiters.forEach(function (styleDelimeters: LayoutDelimiters) {
						if (styleDelimeters.inPair) {
							allSpans.push(new Span(styleDelimeters.lastStart, word.length, styleDelimeters.style));
							styleDelimeters.lastStart = -1;
							styleDelimeters.inPair = false;
							activeStyle = LayoutStyle.normal;
							styleDelimeters.needToClose = false;
						}
					}, this);
				}

			}

			SpellBook.styleDelimiters.forEach(function (styleDelimeters: LayoutDelimiters) {
				if (styleDelimeters.needToClose) {
					allSpans.push(new Span(styleDelimeters.lastStart, currentLine.length - lastPart.length, styleDelimeters.style));
					styleDelimeters.lastStart = -1;
					styleDelimeters.inPair = false;
					activeStyle = LayoutStyle.normal;
					styleDelimeters.needToClose = false;
				}
			}, this);
		}

		// One last check to see if any styles are left hanging and need closure...
		SpellBook.styleDelimiters.forEach(function (styleDelimeters: LayoutDelimiters) {
			if (styleDelimeters.lastStart >= 0) {
				if (currentLine.length > 0) {
					allSpans.push(new Span(styleDelimeters.lastStart, currentLine.length - lastPart.length, styleDelimeters.style));
					styleDelimeters.lastStart = -1;
				}
			}
		}, this);

		lines.push(new LineWrapData(currentLine, allSpans, lineWidth, indent, isBullet, inTableRow));
		return lines;
	}

	private getWordWrappedLinesForParagraphs(context: CanvasRenderingContext2D, text: string, maxScaledWidth: number): ParagraphWrapData {
		this.initializeStyleDelimiters();

		let lines: Array<LineWrapData> = text.split("\n").map(para => this.getWordWrappedLines(context, para, maxScaledWidth)).reduce((a, b) => a.concat(b), []);
		let paragraphWrapData: ParagraphWrapData = new ParagraphWrapData();
		paragraphWrapData.lineData = lines;
		paragraphWrapData.createTables(context);
		return paragraphWrapData;
	}


	private initializeStyleDelimiters() {
		SpellBook.styleDelimiters.forEach(function (styleDelimeters: LayoutDelimiters) {
			styleDelimeters.inPair = false;
			styleDelimeters.lastStart = -1;
			styleDelimeters.needToClose = false;
		});
	}

	private loadFonts() {
		// @ts-ignore - FontFace
		var junction_font = new FontFace('Modesto Condensed Bold', 'url(GameDev/Assets/DragonH/Fonts/617b1b0fd4637fda235c73f27d530305.woff)');
		junction_font.load().then(function (loaded_face) {
			// @ts-ignore - document.fonts
			document.fonts.add(loaded_face);
			document.body.style.fontFamily = '"Modesto Condensed Bold", Arial';
		}).catch(function (error) {
			console.log('Font loading error: ' + error);
		});
	}

	drawSpellTitle(now: number, context: CanvasRenderingContext2D, spell: ActiveSpellData): any {
		this.setTitleFont(context, this.titleFontSize);
		context.fillStyle = this.titleColors[spell.schoolOfMagic];
		context.fillText(spell.name, this.titleTopLeft.x, this.titleTopLeft.y);
	}

	getSpellLevelSchoolWidth(context: CanvasRenderingContext2D, spell: ActiveSpellData): number {
		this.setDetailFontNormal(context);
		let levelStr: string = this.getLevelStr(spell);
		let castAtLevelStr: string = '';

		let castStr: string = this.getSchoolCastingStr(levelStr, spell, castAtLevelStr);

		let width: number = context.measureText(castStr).width;

		if (spell.morePowerfulAtHigherLevels && spell.spellSlotLevel > spell.spellLevel) {
			if (spell.powerComesFromCasterLevel) {
				width += context.measureText(`, cast by a level ${spell.playerLevel} adventurer`).width;
			}
			else {
				this.setDetailFontBold(context);
				width += context.measureText('upcast ').width;

				this.setDetailFontNormal(context);
				width += context.measureText('to ').width;

				this.setDetailFontBold(context);
				width += context.measureText(`slot level ${spell.spellSlotLevel}`).width;
			}

			this.setActiveStyle(context, LayoutStyle.normal);
			return width;
		}
	}

	private getLevelStr(spell: ActiveSpellData) {
		if (spell.spellLevel == 0)
			return 'Cantrip';
		else {
			return `Level ${spell.spellLevel}`;
		}
	}

	drawSpellLevelSchool(now: number, context: CanvasRenderingContext2D, spell: ActiveSpellData): any {
		this.setDetailFontNormal(context);
		context.fillStyle = SpellBook.textColor;
		let levelStr: string = this.getLevelStr(spell);
		let castAtLevelStr: string = '';

		let castStr: string = this.getSchoolCastingStr(levelStr, spell, castAtLevelStr);
		let x: number = this.levelSchoolTopLeft.x;
		let y: number = this.levelSchoolTopLeft.y;
		context.fillText(castStr, x, y);

		if (spell.morePowerfulAtHigherLevels && spell.spellSlotLevel > spell.spellLevel) {
			x += context.measureText(castStr).width;
			const commaSepStr: string = ', ';
			context.fillText(commaSepStr, x, y);
			x += context.measureText(commaSepStr).width;

			if (spell.powerComesFromCasterLevel) {
				const castByAStr: string = 'cast by a ';
				this.setDetailFontNormal(context);
				context.fillText(castByAStr, x, y);
				x += context.measureText(castByAStr).width;

				const levelStr: string = `level ${spell.playerLevel} `;
				this.setDetailFontBold(context);
				context.fillStyle = SpellBook.emphasisColor;
				context.fillText(levelStr, x, y);
				x += context.measureText(levelStr).width;

				this.setDetailFontNormal(context);
				context.fillStyle = SpellBook.textColor;
				context.fillText('adventurer', x, y);
			}
			else {
				const upcastStr: string = 'upcast ';
				this.setDetailFontBold(context);
				context.fillText(upcastStr, x, y);
				x += context.measureText(upcastStr).width;

				const atStr: string = 'to ';
				this.setDetailFontNormal(context);
				context.fillText(atStr, x, y);
				x += context.measureText(atStr).width;

				this.setDetailFontBold(context);
				context.fillStyle = SpellBook.emphasisColor;
				context.fillText(`slot level ${spell.spellSlotLevel}`, x, y);
				context.fillStyle = SpellBook.textColor;
			}


			this.setDetailFontNormal(context);
		}
	}

	private getSchoolCastingStr(levelStr: string, spell: ActiveSpellData, castAtLevelStr: string): string {
		return `${levelStr} ${this.toSchoolDisplayName(spell.schoolOfMagic)}${castAtLevelStr}`;
	}

	drawSpellDescription(now: number, context: CanvasRenderingContext2D, spell: ActiveSpellData): void {
		this.setDetailFontNormal(context);
		context.fillStyle = SpellBook.textColor;
		let x: number = this.spellDescriptionTopLeft.x;
		let y: number = this.spellDescriptionTopLeft.y;

		this.activeStyle = LayoutStyle.normal;

		let lines = this.descriptionParagraphs.lineData; // this.getWordWrappedLinesForParagraphs(context, spell.description, SpellBook.spellDescriptionWidth * this.horizontalScale);

		for (let i = 0; i < lines.length; i++) {
			let lineData: LineWrapData = lines[i];

			if (lineData.isBullet) {
				this.drawBullet(context, x, y);
			}

			if (lineData.inTableRow) {
				this.setActiveStyle(context, LayoutStyle.normal);
				this.drawTableRow(context, x, y, lineData);
				if (lineData.line.indexOf('---') >= 0) {
					y -= SpellBook.detailFontSize / 2;
				}
			}
			else if (lineData.allSpans.length > 0) {
				let offsetX: number = lineData.indent;
				let lastDrawnStyledOffset: number = 0;
				for (let spanIndex = 0; spanIndex < lineData.allSpans.length; spanIndex++) {
					let span: Span = lineData.allSpans[spanIndex];

					let onTheVeryLastSpan: boolean = spanIndex == lineData.allSpans.length - 1;

					// Special case (first span):
					if (span.startOffset > lastDrawnStyledOffset) {
						// We have a normal part first
						this.setActiveStyle(context, LayoutStyle.normal);
						let normalPart: string = lineData.line.substr(lastDrawnStyledOffset, span.startOffset - lastDrawnStyledOffset);
						context.fillText(normalPart, x + offsetX, y);
						offsetX += context.measureText(normalPart).width;
					}
					// Draw the styled part...
					let styledPart: string = lineData.line.substr(span.startOffset, span.stopOffset - span.startOffset);
					this.setActiveStyle(context, span.style);

					let wordTop: number = y + this.getStyleDelimeters(span.style).fontYOffset;
					let styledPartWidth: number = context.measureText(styledPart).width;

					if (span.style == LayoutStyle.calculated) {  // Underline this.
						let wordStartX: number = x + offsetX;
						let wordEndX: number = wordStartX + styledPartWidth;
						if (styledPart.startsWith(' ')) {
							wordStartX += context.measureText(' ').width;
						}
						context.beginPath();
						let lineY: number = wordTop + SpellBook.emphasisFontStyleAscender + this.underlineOffset;
						context.lineWidth = 2;
						context.strokeStyle = '#3e6bb8';
						context.moveTo(wordStartX, lineY);
						context.lineTo(wordEndX, lineY);
						context.stroke();
					}

					context.fillText(styledPart, x + offsetX, wordTop);
					offsetX += styledPartWidth;

					lastDrawnStyledOffset = span.stopOffset;

					// Special case (last span):
					if (onTheVeryLastSpan && span.stopOffset < lineData.line.length) {
						// We have a normal ending part
						let endStart: number = span.stopOffset;
						let normalPart: string = lineData.line.substr(endStart, lineData.line.length - endStart);
						this.setActiveStyle(context, LayoutStyle.normal);
						context.fillText(normalPart, x + offsetX, y);
						offsetX += context.measureText(normalPart).width;
					}
				}
			}
			else {
				this.setActiveStyle(context, LayoutStyle.normal);
				context.fillText(lineData.line, x + lineData.indent, y);
			}
			y += SpellBook.detailFontSize;
		}
	}

	drawTableRow(context: CanvasRenderingContext2D, x: number, y: number, lineData: LineWrapData): any {
		let cells: string[] = lineData.line.split('|').filter(Boolean);
		let offset: number = 0;
		context.save();
		for (let i = 0; i < cells.length; i++) {
			let cellText: string = cells[i].trim();
			if (!lineData.table.columns) {
				console.error('lineData.table.columns is null!!!');
			}
			let column: Column = lineData.table.columns[i];
			offset += SpellBook.tableCellHorizontalMargin;
			let textX: number = x + offset;
			if (cellText.indexOf('---') >= 0) {
				// Draw header separator line...
				context.beginPath();
				let lineY: number = y + SpellBook.detailFontSize / 4;
				context.moveTo(textX, lineY);
				context.lineTo(textX + column.width, lineY);
				context.strokeStyle = SpellBook.tableLineColor;
				context.globalAlpha = 0.5;
				context.stroke();
				context.globalAlpha = 1;
			}
			else {
				if (column.justification === Justification.right) {
					context.textAlign = 'right';
					textX += column.width;
				}
				else if (column.justification === Justification.center) {
					context.textAlign = 'center';
					textX += column.width / 2;
				}
				else {
					context.textAlign = 'left';
				}

				context.fillText(cellText, textX, y);
			}

			offset += column.width + SpellBook.tableCellHorizontalMargin;
		}
		context.restore();
	}

	private drawBullet(context: CanvasRenderingContext2D, x: number, y: number) {
		const bulletRadius: number = SpellBook.detailFontSize / 4;
		context.save();
		context.beginPath();
		context.globalAlpha = 0.75;
		context.fillStyle = SpellBook.bulletColor;
		let halfFontHeight: number = SpellBook.detailFontSize / 2;
		context.arc(x + SpellBook.bulletIndent - 2 * bulletRadius, y + halfFontHeight, bulletRadius, 0, 2 * Math.PI);
		context.fill();
		context.restore();
	}

	getStyleDelimeters(style: LayoutStyle): LayoutDelimiters {
		for (let i = 0; i < SpellBook.styleDelimiters.length; i++) {
			if (SpellBook.styleDelimiters[i].style == style)
				return SpellBook.styleDelimiters[i];
		}
		return null;
	}

	setActiveStyle(context: CanvasRenderingContext2D, style: LayoutStyle): any {
		this.activeStyle = style;
		switch (style) {
			case LayoutStyle.bold:
				this.setDetailFontBold(context);
				context.fillStyle = SpellBook.textColor;
				return;
			case LayoutStyle.italic:
				this.setDetailFontItalic(context);
				context.fillStyle = SpellBook.textColor;
				return;
			case LayoutStyle.calculated:  // Larger, dark red font.
				this.setInlineDetailFontCalculated(context);
				context.fillStyle = SpellBook.emphasisColor;
				return;
		}
		context.fillStyle = SpellBook.textColor;
		this.setDetailFontNormal(context);
	}

	getDetailSize(context: CanvasRenderingContext2D, spell: ActiveSpellData): Vector {
		this.setDetailFontNormal(context);

		let lineCount: number = 0;
		let spacerCount: number = 0;
		let height: number = 0;
		let width: number = 0;

		height += SpellBook.detailFontSize;  // Casting time.
		lineCount++; // Casting time.
		this.wrappedSubCastingLines = [];
		this.wrappedSubRangeLines = [];
		this.wrappedSubComponentMaterialLines = [];

		function checkWidth(testWidth: number) {
			if (testWidth > width)
				width = testWidth;
		}

		let commaPos: number = spell.castingTimeStr.indexOf(',');

		if (commaPos < 0)
			this.castingTime = spell.castingTimeStr;
		else {
			this.castingTime = spell.castingTimeStr.substr(0, commaPos).trim();
			let remainingCastingDetails: string = spell.castingTimeStr.substr(commaPos + 1).trim();
			this.wrappedSubCastingLines = this.getWrappedSubDetailLines(context, remainingCastingDetails);
			let castingLinesExtraCount: number = this.wrappedSubCastingLines.length;
			height += SpellBook.detailFontSize * castingLinesExtraCount;
			lineCount += castingLinesExtraCount;
		}

		checkWidth(this.measureDetail(context, SpellBook.str_CastingTime, this.castingTime));

		height += SpellBook.detailSpacing;
		spacerCount++;

		height += SpellBook.detailFontSize + SpellBook.detailSpacing;  // Range
		lineCount++;
		spacerCount++;
		let parenPos: number = spell.rangeStr.indexOf('(');

		if (parenPos < 0)
			this.rangeSummary = spell.rangeStr;
		else {
			this.rangeSummary = spell.rangeStr.substr(0, parenPos).trim();
			let remainingRangeDetails: string = spell.rangeStr.substr(parenPos).trim();
			this.wrappedSubRangeLines = this.getWrappedSubDetailLines(context, remainingRangeDetails);
			let rangeLinesExtraCount: number = this.wrappedSubRangeLines.length;
			height += SpellBook.detailFontSize * rangeLinesExtraCount;
			lineCount += rangeLinesExtraCount;
		}

		checkWidth(this.measureDetail(context, SpellBook.str_Range, this.rangeSummary));

		if (spell.componentsStr) {
			height += SpellBook.detailFontSize;
			lineCount++;

			let parenIndex = spell.componentsStr.indexOf('(');

			if (parenIndex > 0) {
				this.componentSummary = spell.componentsStr.substr(0, parenIndex).trim();
				let componentMaterials: string = spell.componentsStr.substr(parenIndex);
				if (componentMaterials) {
					this.wrappedSubComponentMaterialLines = this.getWrappedSubDetailLines(context, componentMaterials);
					let componentsExtraLines: number = this.wrappedSubComponentMaterialLines.length;

					height += SpellBook.detailFontSize * componentsExtraLines;
					lineCount += componentsExtraLines;
				}
			}
			else
				this.componentSummary = spell.componentsStr;

			checkWidth(this.measureDetail(context, SpellBook.str_Components, this.componentSummary));

			height += SpellBook.detailSpacing;
			spacerCount++;
		}

		height += SpellBook.detailFontSize + SpellBook.detailSpacing;   // Duration
		lineCount++;

		let durationStr: string = this.getDurationStr(spell);
		checkWidth(this.measureDetail(context, SpellBook.str_Duration, durationStr));

		console.log('Detail: lineCount: ' + lineCount);
		console.log('Detail: spacerCount: ' + spacerCount);
		return new Vector(width, height);
	}

	drawSpellDetails(now: number, context: CanvasRenderingContext2D, spell: ActiveSpellData): void {
		context.fillStyle = SpellBook.textColor;
		let x: number = this.spellDetailsTopLeft.x + this.schoolOfMagicAdjust;
		let y: number = this.spellDetailsTopLeft.y;


		this.showDetail(context, SpellBook.str_CastingTime, this.castingTime, x, y);
		y += SpellBook.detailFontSize;

		if (this.wrappedSubCastingLines) {
			let castingTimeX: number = x + SpellBook.castingSubDetailIndent;
			this.setDetailFontNormal(context);
			y = this.wrapDetailLines(context, this.wrappedSubCastingLines, castingTimeX, y);
		}
		y += SpellBook.detailSpacing;



		this.showDetail(context, SpellBook.str_Range, this.rangeSummary, x, y);
		y += SpellBook.detailFontSize;
		if (this.wrappedSubRangeLines) {
			const materialX: number = x + SpellBook.castingSubDetailIndent;
			this.setDetailFontNormal(context);
			y = this.wrapDetailLines(context, this.wrappedSubRangeLines, materialX, y);
		}
		y += SpellBook.detailSpacing;


		if (spell.componentsStr) {
			this.showDetail(context, SpellBook.str_Components, this.componentSummary, x, y);
			y += SpellBook.detailFontSize;

			if (this.wrappedSubComponentMaterialLines) {
				const materialX: number = x + SpellBook.castingSubDetailIndent;
				this.setDetailFontNormal(context);
				y = this.wrapDetailLines(context, this.wrappedSubComponentMaterialLines, materialX, y);
			}
			y += SpellBook.detailSpacing;
		}

		let durationStr: string = this.getDurationStr(spell);
		this.showDetail(context, SpellBook.str_Duration, durationStr, x, y);
	}

	private getDurationStr(spell: ActiveSpellData): string {
		let durationStr: string = spell.durationStr;
		const concentrationPrefix: string = SpellBook.str_ConcentrationPrefix;
		if (durationStr.startsWith(concentrationPrefix))
			durationStr = spell.durationStr.substr(concentrationPrefix.length);
		return durationStr;
	}

	private wrapDetailLines(context: CanvasRenderingContext2D, lines: LineWrapData[], x: number, y: number) {
		for (let i = 0; i < lines.length; i++) {
			context.fillText(lines[i].line, x, y);
			y += SpellBook.detailFontSize;
		}
		return y;
	}

	private getWrappedSubDetailLines(context: CanvasRenderingContext2D, detailStr: string) {
		return this.getWordWrappedLines(context, detailStr, this.availableSpellDetailsWidth * this.horizontalScale - SpellBook.castingSubDetailIndent);
	}

	showDetail(context: CanvasRenderingContext2D, label: string, data: string, x: number, y: number): void {
		this.setDetailFontNormal(context);
		context.fillText(label, x, y);
		x += context.measureText(label).width;
		this.setDetailFontBold(context);
		context.fillText(data, x, y);
	}

	measureDetail(context: CanvasRenderingContext2D, label: string, data: string): number {
		let result: number = 0;
		this.setDetailFontNormal(context);
		result += context.measureText(label).width;
		this.setDetailFontBold(context);
		result += context.measureText(data).width;
		return result;
	}

	toSchoolDisplayName(schoolOfMagic: SchoolOfMagic): string {
		switch (schoolOfMagic) {
			case SchoolOfMagic.Abjuration: return 'abjuration';
			case SchoolOfMagic.Conjuration: return 'conjuration';
			case SchoolOfMagic.Divination: return 'divination';
			case SchoolOfMagic.Enchantment: return 'enchantment';
			case SchoolOfMagic.Evocation: return 'evocation';
			case SchoolOfMagic.Illusion: return 'illusion';
			case SchoolOfMagic.Necromancy: return 'necromancy';
			case SchoolOfMagic.Transmutation: return 'transmutation';
		}
		return '';
	}

	private setTitleFont(context: CanvasRenderingContext2D, fontSize: number) {
		context.font = `${fontSize}px ${SpellBook.titleFontName}`;
	}

	private setDetailFontNormal(context: CanvasRenderingContext2D) {
		context.font = `${SpellBook.detailFontSize}px ${SpellBook.detailFontName}`;
	}

	private setDetailFontBold(context: CanvasRenderingContext2D) {
		context.font = `700 ${SpellBook.detailFontSize}px ${SpellBook.detailFontName}`;
		//context.font = `${SpellBook.detailFontSize}px ${SpellBook.detailBoldFontName}`;
	}


	private setDetailFontItalic(context: CanvasRenderingContext2D) {
		context.font = `700 italic ${SpellBook.detailFontSize}px ${SpellBook.detailFontName}`;
	}

	private setInlineDetailFontCalculated(context: CanvasRenderingContext2D) {
		context.font = `700 ${SpellBook.detailFontSize + SpellBook.emphasisFontHeightIncrease}px ${SpellBook.detailFontName}`;
		//context.font = `${SpellBook.detailFontSize}px ${SpellBook.detailBoldFontName}`;
	}

	draw(now: number,
		context: CanvasRenderingContext2D,
		x: number,
		y: number,
		player: Character): void {

		let spell: ActiveSpellData = player.getActiveSpell();

		if (!spell)
			return;

		if (this.lastSpellName != spell.name || this.lastSpellSlotLevel != spell.spellSlotLevel) {
			this.lastSpellName = spell.name;
			this.lastSpellSlotLevel = spell.spellSlotLevel;
			this.lastPlayerId = player.playerID;

			let scale: number = 1;
			while (scale < 3 && !this.createSpellPage(context, x, y, spell, scale)) {
				scale += 0.01;
			}
		}

		this.bookGlow.draw(context, now * 1000);

		if (this.spellBookBack.sprites.length > 0) {
			let firstBackSprite = this.spellBookBack.sprites[0];
			// ![](4E7BDCDC4E1A78AB2CC6D9EF427CBD98.png)
			let w: number = this.spellBookBack.spriteWidth;
			let h: number = this.spellBookBack.spriteHeight;
			this.spellBookBack.drawCropped(context, now * 1000, firstBackSprite.x, firstBackSprite.y + h - this.spellBookBackHeight, 0, h - this.spellBookBackHeight, w, this.spellBookBackHeight, w * this.horizontalScale, this.spellBookBackHeight);
		}

		this.spellBookTop.draw(context, now * 1000);
		this.schoolOfMagic.draw(context, now * 1000);
		this.concentrationIcon.draw(context, now * 1000);
		this.morePowerIcon.draw(context, now * 1000);

		this.drawSpellTitle(now, context, spell);
		this.drawSpellLevelSchool(now, context, spell);
		this.drawSpellDetails(now, context, spell);
		this.drawSpellDescription(now, context, spell);
	}


	getTitleFontSize(context: CanvasRenderingContext2D, name: string, requiresConcentration: boolean, morePowerfulAtHigherLevels: boolean): number {
		let fontSize: number = SpellBook.titleFontIdealSize;
		this.setTitleFont(context, fontSize);
		this.titleWidth = context.measureText(name).width;

		function getIconSpace(iconScale: number, horizontalScale: number): number {
			let iconSpace: number = 0;
			if (requiresConcentration || morePowerfulAtHigherLevels) {
				iconSpace += SpellBook.titleFirstIconSpacing * horizontalScale + SpellBook.iconSize * iconScale;
				if (requiresConcentration && morePowerfulAtHigherLevels)
					iconSpace += SpellBook.iconSpacing * horizontalScale + SpellBook.iconSize * iconScale;
			}
			return iconSpace;
		}

		let maxTitleWidth: number = SpellBook.maxTitleWidth * this.horizontalScale;

		while (this.titleWidth > maxTitleWidth - getIconSpace(this.getIconScale(fontSize), this.horizontalScale)) {
			fontSize--;
			if (fontSize <= 6) {
				return fontSize;
			}
			this.setTitleFont(context, fontSize);
			this.titleWidth = context.measureText(name).width;
		}
		return fontSize;
	}

	loadResources(): any {
		this.spellBookBack = new Sprites("Scroll/Spells/BookBottom", 1, 0, AnimationStyle.Static);
		this.spellBookBack.originX = 0;
		this.spellBookBack.originY = 999;
		this.spellBookTop = new Sprites("Scroll/Spells/BookTop", 1, 0, AnimationStyle.Static);
		this.schoolOfMagic = new Sprites("Scroll/Spells/SchoolsOfMagic", 8, 0, AnimationStyle.Static);
		this.concentrationIcon = new Sprites("Scroll/Spells/Concentration/Concentration", 8, 0, AnimationStyle.Static);
		this.concentrationIcon.originX = 0;
		this.concentrationIcon.originY = SpellBook.iconSize;
		this.morePowerIcon = new Sprites("Scroll/Spells/MorePower/MorePower", 8, 0, AnimationStyle.Static);
		this.morePowerIcon.originX = 0;
		this.morePowerIcon.originY = SpellBook.iconSize;
		this.bookGlow = new Sprites("Scroll/Spells/BookMagic/BookMagic", 119, fps30, AnimationStyle.Loop, true);
	}

	createSpellPage(context: CanvasRenderingContext2D, x: number, y: number, spell: ActiveSpellData, horizontalScale: number): boolean {
		this.horizontalScale = horizontalScale;

		this.setDetailFontNormal(context);
		let maxSpellDescriptionWidth: number = SpellBook.spellDescriptionWidth * this.horizontalScale;
		this.descriptionParagraphs = this.getWordWrappedLinesForParagraphs(context, spell.description, maxSpellDescriptionWidth);

		if (this.descriptionParagraphs.maxTableWidth > maxSpellDescriptionWidth)
			return false;

		if (this.getSpellLevelSchoolWidth(context, spell) > maxSpellDescriptionWidth)
			return false;

		this.spellBookBack.sprites = [];
		this.spellBookTop.sprites = [];
		this.schoolOfMagic.sprites = [];
		this.concentrationIcon.sprites = [];
		this.morePowerIcon.sprites = [];
		this.bookGlow.sprites = [];

		let left: number = x + 12;
		let top: number = y - 33;


		this.titleFontSize = this.getTitleFontSize(context, spell.name, spell.requiresConcentration, spell.morePowerfulAtHigherLevels);

		let descriptionLinesWeNeedToAdd: number = this.descriptionParagraphs.lineData.length;
		let descriptionHeightWeNeedToAdd: number = descriptionLinesWeNeedToAdd * (SpellBook.detailFontSize);


		this.schoolOfMagicAdjust = 0;
		this.availableSpellDetailsWidth = SpellBook.spellDetailsWidth;
		let schoolOfMagicWidth: number = SpellBook.schoolOfMagicWidth;

		let schoolOfMagicIndent: number;
		if (spell.schoolOfMagic == SchoolOfMagic.None) {
			schoolOfMagicIndent = 0;
			schoolOfMagicWidth = 0;
			this.availableSpellDetailsWidth += SpellBook.schoolOfMagicWidth;
		}
		else {
			if (spell.schoolOfMagic == SchoolOfMagic.Abjuration) {
				this.schoolOfMagicAdjust = SpellBook.abjurationAdjust;
				this.availableSpellDetailsWidth -= SpellBook.abjurationAdjust;
			}

			schoolOfMagicIndent = SpellBook.schoolOfMagicIndent - this.schoolOfMagicAdjust;
		}


		let detailSize: Vector = this.getDetailSize(context, spell);
		let detailsHeight: number = Math.max(detailSize.y + SpellBook.detailFontSize, this.getSchoolOfMagicHeight(spell.schoolOfMagic));

		let totalSpellPageHeight: number = SpellBook.spellHeaderHeight + detailsHeight + descriptionHeightWeNeedToAdd;

		if (this.getSpellDescriptionBottom(top, totalSpellPageHeight) > SpellBook.bottomWindowHeight) {
			top = this.getNewTop(SpellBook.bottomWindowHeight, totalSpellPageHeight);
		}

		let spellBottom: number = this.getSpellDescriptionBottom(top, totalSpellPageHeight);
		if (spellBottom > SpellBook.fredHeadY) {
			top = this.getNewTop(SpellBook.fredHeadY, totalSpellPageHeight);
		}

		if (top < 0) {
			top = 0;

			if (this.getSpellDescriptionBottom(top, totalSpellPageHeight) > SpellBook.maxSpellBookHeight)
				return false;  // Not enough space for the spell at this horizontal scale.
		}

		spellBottom = this.getSpellDescriptionBottom(top, totalSpellPageHeight);

		if (spellBottom > SpellBook.fredShoulderY) {
			left = Math.max(left, SpellBook.fredShoulderX);
		}
		else if (spellBottom > SpellBook.fredHeadY) {
			left = Math.max(left, SpellBook.fredHeadX);
		}

		if (spell.schoolOfMagic == SchoolOfMagic.Abjuration) {

		}

		this.spellDescriptionTopLeft = new Vector(left + SpellBook.titleLeftMargin, top + SpellBook.spellHeaderHeight + detailsHeight);
		this.titleTopLeft = new Vector(left + SpellBook.titleLeftMargin, top + 27);
		this.levelSchoolTopLeft = new Vector(left + SpellBook.titleLeftMargin, this.titleTopLeft.y + this.titleFontSize + SpellBook.titleLevelMargin);
		let schoolOfMagicTopLeft: Vector = new Vector(left + schoolOfMagicIndent, this.levelSchoolTopLeft.y + SpellBook.detailFontSize + SpellBook.levelDetailsMargin);

		this.spellDetailsTopLeft = new Vector(left + schoolOfMagicWidth, schoolOfMagicTopLeft.y);
		if (detailSize.x > this.availableSpellDetailsWidth * horizontalScale)
			return false;

		let lowerSpellBookTop: number = top + totalSpellPageHeight;

		this.spellBookBackHeight = totalSpellPageHeight;
		let spellBookBack: SpriteProxy = this.spellBookBack.add(left, lowerSpellBookTop, 0);
		spellBookBack.horizontalScale = this.horizontalScale;
		spellBookBack.timeStart = 0;
		let spellBookFront: SpriteProxy = this.spellBookTop.add(left, top, 0);
		spellBookFront.timeStart = 0;
		spellBookFront.horizontalScale = this.horizontalScale;

		let schoolOfMagicIndex = spell.schoolOfMagic - 1;
		if (spell.schoolOfMagic > SchoolOfMagic.None) {
			this.schoolOfMagic.add(schoolOfMagicTopLeft.x, schoolOfMagicTopLeft.y, schoolOfMagicIndex).timeStart = 0;
		}


		let iconScale: number = this.getIconScale(this.titleFontSize);
		let iconX = left + SpellBook.titleLeftMargin + this.titleWidth + SpellBook.titleFirstIconSpacing * this.horizontalScale;
		let iconY = this.titleTopLeft.y + this.titleFontSize;

		if (spell.requiresConcentration) {
			this.concentrationIcon.add(iconX, iconY, schoolOfMagicIndex).scale = iconScale;
			iconX += SpellBook.iconSize * iconScale + SpellBook.iconSpacing * this.horizontalScale;
		}

		if (spell.morePowerfulAtHigherLevels) {
			this.morePowerIcon.add(iconX, iconY, schoolOfMagicIndex).scale = iconScale;
		}

		// TODO: Consider adding SpellBook.spellBottomMargin instead of SpellBook.bookSpellHeightAdjust
		totalSpellPageHeight += SpellBook.bookSpellHeightAdjust;

		//` <formula 2.5; verticalScale = \frac{totalSpellPageHeight}{bookGlowHeight}>
		let verticalScale: number = totalSpellPageHeight / SpellBook.bookGlowHeight;
		let topScaledMargin: number = SpellBook.bookGlowTopMargin * verticalScale;

		let bookGlow: ColorShiftingSpriteProxy = this.bookGlow.addShifted(left - SpellBook.bookGlowLeftMargin * this.horizontalScale, top - topScaledMargin, 0, this.hueShifts[spell.schoolOfMagic]);
		bookGlow.horizontalScale = this.horizontalScale;
		bookGlow.verticalScale = verticalScale;
		return true;
	}

	private getIconScale(titleFontSize: number): number {
		return Math.min(1, titleFontSize / SpellBook.iconScaleDenominator);
	}

	getSchoolOfMagicHeight(schoolOfMagic: SchoolOfMagic): any {
		if (schoolOfMagic == SchoolOfMagic.Abjuration)
			return SpellBook.schoolOfMagicAbjurationHeight;
		return SpellBook.schoolOfMagicHeight;
	}

	private getNewTop(bottom: number, totalSpellPageHeight: number): number {
		return bottom - totalSpellPageHeight - SpellBook.spellBottomMargin;
	}

	private getSpellDescriptionBottom(top: number, totalSpellPageHeight: number) {
		return top + totalSpellPageHeight + SpellBook.spellBottomMargin;
	}
}