﻿using System;
using System.Linq;
using System.Diagnostics;
using System.Collections.Generic;

namespace DndCore
{
	[HasDndEvents]
	public class Feature
	{
		public static event FeatureEventHandler FeatureActivated;
		public static event FeatureEventHandler FeatureDeactivated;
		public static event MessageEventHandler RequestMessageToDungeonMaster;
		protected static void OnRequestMessageToDungeonMaster(Feature feature, string message)
		{
			RequestMessageToDungeonMaster?.Invoke(feature, new MessageEventArgs(message));
		}
		public static void OnFeatureActivated(object sender, FeatureEventArgs ea)
		{
			FeatureActivated?.Invoke(sender, ea);
		}
		public static void OnFeatureDeactivated(object sender, FeatureEventArgs ea)
		{
			FeatureDeactivated?.Invoke(sender, ea);
		}
		public Feature()
		{

		}

		public string ActivateWhen { get; set; }
		[DndEvent]
		public string OnStartGame { get; set; }
		public DndTimeSpan Duration { get; set; }
		public bool IsActive { get; private set; }
		public string Limit { get; set; }  // Could be an expression.
		public string Name { get; set; }
		[DndEvent]
		public string OnActivate { get; set; }
		[DndEvent]
		public string OnDeactivate { get; set; }
		[DndEvent]
		public string OnPlayerCastsSpell { get; set; }
		[DndEvent]
		public string OnPlayerSwingsWeapon { get; set; }
		[DndEvent]
		public string OnPlayerStartsTurn { get; set; }
		[DndEvent]
		public string OnPlayerSaves { get; set; }
		[DndEvent]
		public string OnRollComplete { get; set; }
		public DndTimeSpan Per { get; set; }
		public bool RequiresPlayerActivation { get; set; }
		public List<string> Parameters { get; set; }
		public string Description { get; set; }
		public string ActivationMessage { get; set; }
		public string DeactivationMessage { get; set; }
		public TurnPart ActivationTime { get; set; }
		public string ShortcutName { get; set; }
		public string ShortcutAvailableWhen { get; set; }
		public bool Magic { get; set; }

		public bool AlwaysOn
		{
			get
			{
				string conditions = ActivateWhen;
				if (conditions == null)
					return false;
				return conditions.Trim().ToLower() == "true";
			}
		}
		public static Feature FromDto(FeatureDto featureDto)
		{
			Feature result = new Feature();
			result.Name = DndUtils.GetName(featureDto.Name);
			result.Parameters = DndUtils.GetParameters(featureDto.Name);
			result.ActivateWhen = featureDto.ActivateWhen;
			result.OnStartGame = featureDto.OnStartGame;
			result.Description = featureDto.Description;
			result.OnActivate = featureDto.OnActivate;
			result.ActivationMessage = featureDto.ActivationMessage;
			result.OnDeactivate = featureDto.OnDeactivate;
			result.DeactivationMessage = featureDto.DeactivationMessage;
			result.OnPlayerCastsSpell = featureDto.OnPlayerCastsSpell;
			result.OnPlayerSwingsWeapon = featureDto.OnPlayerSwingsWeapon;
			result.OnPlayerStartsTurn = featureDto.OnPlayerStartsTurn;
			result.OnPlayerSaves = featureDto.OnPlayerSaves;
			result.OnRollComplete = featureDto.OnRollComplete;
			result.ShortcutName = featureDto.ShortcutName;
			result.ShortcutAvailableWhen = featureDto.ShortcutAvailableWhen;
			result.Magic = MathUtils.IsChecked(featureDto.Magic);
			result.ActivationTime = PlayerActionShortcut.GetTurnPart(featureDto.ActivationTime);
			result.RequiresPlayerActivation = MathUtils.IsChecked(featureDto.RequiresActivation);
			result.Duration = DndTimeSpan.FromDurationStr(featureDto.Duration);
			result.Per = DndTimeSpan.FromDurationStr(featureDto.Per);
			result.Limit = featureDto.Limit;
			return result;
		}

		public void Activate(string arguments, Character player, bool forceActivation = false)
		{
			if (IsActive && !forceActivation)
				return;

			string activationMessage;
			if (!string.IsNullOrWhiteSpace(ActivationMessage))
			{
				activationMessage = Expressions.GetStr(DndUtils.InjectParameters(ActivationMessage, Parameters, arguments), player);
			}
			else if (player != null)
				activationMessage = $"Activating {player.name}'s {Name}.";
			else
				activationMessage = $"Activating {Name}.";

			IsActive = true;
			if (Duration.HasValue())
			{
				string alarmName = $"{player.name}.{Name}";
				TimeSpan duration = Duration.GetTimeSpan();
				if (player.Game != null)
					player.Game.CreateAlarm(duration, alarmName, player, this).AlarmFired += Feature_Expired;
				else
					History.TimeClock.CreateAlarm(duration, alarmName, player, this).AlarmFired += Feature_Expired;
			}
			TriggerActivate(arguments, player);
			OnRequestMessageToDungeonMaster(this, activationMessage);
			OnFeatureActivated(player, new FeatureEventArgs(this));
		}

		private void TriggerActivate(string arguments, Character player)
		{
			if (player.NeedToBreakBeforeFiringEvent(EventType.FeatureEvents, Name)) Debugger.Break();
			if (!string.IsNullOrWhiteSpace(OnActivate))
				Expressions.Do(DndUtils.InjectParameters(OnActivate, Parameters, arguments), player);
		}

		public void Deactivate(string arguments, Character player, bool forceDeactivation = false)
		{
			if (!IsActive && !forceDeactivation)
				return;
			string deactivationMessage;
			if (!string.IsNullOrWhiteSpace(DeactivationMessage))
			{
				deactivationMessage = Expressions.GetStr(DndUtils.InjectParameters(DeactivationMessage, Parameters, arguments), player);
			}
			else if (player != null)
				deactivationMessage = $"Deactivating {player.name}'s {Name}.";
			else
				deactivationMessage = $"Deactivating {Name}.";

			IsActive = false;
			TriggerDeactivate(arguments, player);
			OnRequestMessageToDungeonMaster(this, deactivationMessage);
			OnFeatureDeactivated(player, new FeatureEventArgs(this));
		}

		private void TriggerDeactivate(string arguments, Character player)
		{
			if (player.NeedToBreakBeforeFiringEvent(EventType.FeatureEvents, Name)) Debugger.Break();
			if (!string.IsNullOrWhiteSpace(OnDeactivate))
				Expressions.Do(DndUtils.InjectParameters(OnDeactivate, Parameters, arguments), player);
		}

		private void Feature_Expired(object sender, DndTimeEventArgs ea)
		{
			if (IsActive)
				Deactivate(string.Empty, ea.Alarm.Player);
		}

		public void StartGame(string arguments, Character player)
		{
			TriggerStartGame(arguments, player);
		}

		private void TriggerStartGame(string arguments, Character player)
		{
			if (player.NeedToBreakBeforeFiringEvent(EventType.FeatureEvents, Name)) Debugger.Break();
			if (!string.IsNullOrWhiteSpace(OnStartGame))
				Expressions.Do(DndUtils.InjectParameters(OnStartGame, Parameters, arguments), player);
		}

		public bool ShouldActivateNow(List<string> args, Character player)
		{
			if (string.IsNullOrWhiteSpace(ActivateWhen))
				return true;

			return Expressions.GetBool(DndUtils.InjectParameters(ActivateWhen, Parameters, args), player);
		}

		public void SpellJustCast(string arguments, Character player, CastedSpell spell)
		{
			if (!IsActive)
				return;
			TriggerPlayerCastsSpell(arguments, player, spell);
		}

		private void TriggerPlayerCastsSpell(string arguments, Character player, CastedSpell spell)
		{
			if (player.NeedToBreakBeforeFiringEvent(EventType.FeatureEvents, Name)) Debugger.Break();
			if (!string.IsNullOrWhiteSpace(OnPlayerCastsSpell))
				Expressions.Do(DndUtils.InjectParameters(OnPlayerCastsSpell, Parameters, arguments), player, null, spell);
		}

		public void WeaponJustSwung(string arguments, Character player)
		{
			if (!IsActive)
				return;
			TriggerPlayerSwingsWeapon(arguments, player);
		}

		private void TriggerPlayerSwingsWeapon(string arguments, Character player)
		{
			if (player.NeedToBreakBeforeFiringEvent(EventType.FeatureEvents, Name)) Debugger.Break();
			if (!string.IsNullOrWhiteSpace(OnPlayerSwingsWeapon))
				Expressions.Do(DndUtils.InjectParameters(OnPlayerSwingsWeapon, Parameters, arguments), player);
		}

		public void PlayerStartsTurn(string arguments, Character player)
		{
			if (!IsActive)
				return;
			TriggerPlayerStartsTurn(arguments, player);
		}

		private void TriggerPlayerStartsTurn(string arguments, Character player)
		{
			if (player.NeedToBreakBeforeFiringEvent(EventType.FeatureEvents, Name)) Debugger.Break();
			if (!string.IsNullOrWhiteSpace(OnPlayerStartsTurn))
				Expressions.Do(DndUtils.InjectParameters(OnPlayerStartsTurn, Parameters, arguments), player);
		}


		// TODO: Call when a player rolls a saving throw (to implement DangerSense).
		public void PlayerSaves(string arguments, Character player)
		{
			if (!IsActive)
				return;
			TriggerPlayerSaves(arguments, player);
		}

		private void TriggerPlayerSaves(string arguments, Character player)
		{
			if (player.NeedToBreakBeforeFiringEvent(EventType.FeatureEvents, Name)) Debugger.Break();
			if (!string.IsNullOrWhiteSpace(OnPlayerSaves))
				Expressions.Do(DndUtils.InjectParameters(OnPlayerSaves, Parameters, arguments), player);
		}

		public void RollIsComplete(string arguments, Character player)
		{
			if (!IsActive)
				return;
			TriggerRollComplete(arguments, player);
		}

		private void TriggerRollComplete(string arguments, Character player)
		{
			if (player.NeedToBreakBeforeFiringEvent(EventType.FeatureEvents, Name)) Debugger.Break();
			if (!string.IsNullOrWhiteSpace(OnRollComplete))
				Expressions.Do(DndUtils.InjectParameters(OnRollComplete, Parameters, arguments), player);
		}
	}
}
