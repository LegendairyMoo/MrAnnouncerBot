﻿using System;
using System.Collections.Generic;
using CodingSeb.ExpressionEvaluator;

namespace DndCore
{
	public class LevelFunction : DndFunction
	{
		public override string Name => "Level";

		public override object Evaluate(List<string> args, ExpressionEvaluator evaluator, Character player, Creature target, CastedSpell spell)
		{
			ExpectingArguments(args, 1);

			string characterClassName = evaluator.Evaluate<string>(args[0]);

			return player.GetLevel(characterClassName);
		}
	}
}
